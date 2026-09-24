-- RLS for public.attendance_activities.
--
-- Run this once in the Supabase SQL editor. Idempotent -- every policy is
-- dropped before it is created, so it is safe to re-run. (Several files in
-- this repo were NOT re-runnable and died at 42710 mid-paste, silently
-- skipping everything below them; do not reintroduce that.)
--
-- WHY THIS FILE EXISTS AT ALL. Until 2026-09-24 there was no policy file for
-- this table anywhere in the repo, even though docs/finance/
-- EXPENSE-CLAIMS-DESIGN.md and docs/hr/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md
-- both cite "attendance_activities_crud.sql" as the pattern to copy. The live
-- policies were created ad hoc in Studio and were never reviewable here.
--
-- THE HOLE THIS CLOSES. The live self-service policies constrained ONLY
-- employee_id = me. No column guard, no BEFORE trigger. So any employee, using
-- the anon key the app already ships to their browser, could PATCH their own
-- row setting approval_status = Approved, approved_by = themselves, and any
-- clock times they liked -- inventing an approved 14-hour day, or re-opening a
-- Rejected row, without approve_attendance ever being consulted.
--
-- That feeds hours_worked -> overtime_hours -> the statutory rate tiers -> the
-- payroll handoff, with no error anywhere. It also nullified the guarantee
-- create_attendance_backfill_rpc.sql:33-35 explicitly claims ("a crafted
-- request cannot self-approve") -- true of that RPC, false of the table.
--
-- Because RLS WITH CHECK is evaluated against the NEW row, the fix is
-- expressible as policy predicates and needs no trigger.

alter table public.attendance_activities enable row level security;

-- ---------------------------------------------------------------------------
-- 1. SELF-SERVICE -- the tier that was broken
-- ---------------------------------------------------------------------------

drop policy if exists "Enable users to view their own data only" on public.attendance_activities;
drop policy if exists "Employees can view their own attendance" on public.attendance_activities;
create policy "Employees can view their own attendance"
on public.attendance_activities
for select to authenticated
using (employee_id = (select public.current_employee_id()));

-- INSERT: an employee may only ever create an UNAPPROVED row for THEMSELVES.
-- approval_status is pinned rather than merely defaulted: a default is a
-- suggestion the client can override, which is exactly what went wrong.
drop policy if exists "Enable users to insert their own data only" on public.attendance_activities;
drop policy if exists "Employees can log their own attendance" on public.attendance_activities;
create policy "Employees can log their own attendance"
on public.attendance_activities
for insert to authenticated
with check (
    employee_id = (select public.current_employee_id())
    and approval_status = 'Pending'
    and approved_by is null
    and approved_at is null
);

-- UPDATE: only while the row is still Pending, and it must still be Pending
-- afterwards.
--
-- The USING half is what stops an employee editing a row AFTER sign-off (for
-- example lengthening an approved day, or flipping a Rejected row back). The
-- WITH CHECK half is what stops them approving it. Both are needed -- either
-- alone leaves a usable path.
--
-- Clocking out is an UPDATE of clocked_out_at on a still-Pending row, so this
-- does not interfere with the normal flow.
drop policy if exists "Enable users to update their own data only" on public.attendance_activities;
drop policy if exists "Employees can edit their own pending attendance" on public.attendance_activities;
create policy "Employees can edit their own pending attendance"
on public.attendance_activities
for update to authenticated
using (
    employee_id = (select public.current_employee_id())
    and approval_status = 'Pending'
)
with check (
    employee_id = (select public.current_employee_id())
    and approval_status = 'Pending'
    and approved_by is null
    and approved_at is null
);

-- Deliberately NO self-DELETE policy, matching the live state. An employee
-- cannot withdraw their own attendance record; a manager or HR rejects it
-- instead, which leaves the row and its reason in place.

-- ---------------------------------------------------------------------------
-- 2. SEGREGATION OF DUTIES -- restrictive, applies to EVERYONE
-- ---------------------------------------------------------------------------
-- RESTRICTIVE, so it is ANDed with every permissive policy above and below
-- rather than ORed. This is the one rule that must hold no matter which tier
-- you match: nobody approves their own attendance.
--
-- It matters because "HR CRUD" and "Only Managers can CRUD Team Attendance"
-- are both ALL, so an HR employee or a manager would otherwise be able to
-- self-approve by direct PATCH, routing around approve_attendance's guard.
-- Fixing approve_attendance alone (see that file) closes the UI path only.
--
-- SECURITY DEFINER functions bypass RLS, so create_attendance_backfill is
-- unaffected -- its own per-row authorization stands, and HR backfilling their
-- own day through the audited RPC still works.
drop policy if exists "Nobody may approve their own attendance" on public.attendance_activities;
create policy "Nobody may approve their own attendance"
on public.attendance_activities
as restrictive
for all to authenticated
using (true)
with check (
    approval_status <> 'Approved'
    or approved_by is distinct from employee_id
);

-- ---------------------------------------------------------------------------
-- 3. ELEVATED TIERS -- captured from the live state, unchanged in reach
-- ---------------------------------------------------------------------------
-- Recreated here only so this file is the whole picture rather than a patch.
-- If you change one of these, change it here, not in Studio.

drop policy if exists "HR CRUD" on public.attendance_activities;
create policy "HR CRUD"
on public.attendance_activities
for all to authenticated
using (
    exists (select 1 from public.profiles
            where profiles.id = (select auth.uid()) and profiles.department_id = 7)
)
with check (
    exists (select 1 from public.profiles
            where profiles.id = (select auth.uid()) and profiles.department_id = 7)
);

-- Managers get ALL over their own direct reports, including DELETE. Noted here
-- because the consequence is not obvious: attendance_activity_audit is a VIEW
-- over live rows, not an append-only log, so a manager deleting a report's
-- activity erases its audit entry in the same statement. Narrowing this is a
-- separate decision, not a silent change.
drop policy if exists "Only Managers can CRUD Team Attendance" on public.attendance_activities;
create policy "Only Managers can CRUD Team Attendance"
on public.attendance_activities
for all to authenticated
using (
    exists (select 1 from public.employees e
            where e.id = attendance_activities.employee_id
              and e.manager_id = (select public.current_employee_id()))
)
with check (
    exists (select 1 from public.employees e
            where e.id = attendance_activities.employee_id
              and e.manager_id = (select public.current_employee_id()))
);

drop policy if exists "MGM Manager VIEW" on public.attendance_activities;
create policy "MGM Manager VIEW"
on public.attendance_activities
for select to authenticated
using (
    exists (
        select 1 from public.profiles p
        join public.roles r on r.id = p.role_id
        join public.departments d on d.id = p.department_id
        where p.id = (select auth.uid())
          and d.sub = 'MGM'
          and r.name = 'manager'
    )
);

drop policy if exists "Superadmin CRUD" on public.attendance_activities;
create policy "Superadmin CRUD"
on public.attendance_activities
for all to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());
