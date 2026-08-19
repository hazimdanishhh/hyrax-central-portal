-- Run this once in the Supabase SQL editor, AFTER leave_ledger_migration.sql
-- (hyrax-data-platform/infrastructure/) has been run, and after
-- supabase/functions/is_superadmin.sql / current_employee_id.sql exist.
--
-- leave_ledger_entries/leave_ledger_types were deliberately left without
-- RLS when first created (see leave_ledger_migration.sql's own comment) --
-- this is that follow-up, once a real self-service "My Leaves" page needed
-- row-level visibility rather than just the HR-only Leave Management page.
--
-- SELECT-only on both tables: the ONLY writer is
-- sync_leave_ledger_from_snapshot (supabase/sql_editor/sync_leave_ledger_rpc.sql),
-- a SECURITY DEFINER function that runs as its owning role and so bypasses
-- RLS entirely, same as every other write-path RPC in this app (see
-- approve_attendance.sql). No INSERT/UPDATE/DELETE policy is needed or
-- wanted for `authenticated` -- HR2000 remains the system of record, and a
-- direct edit here would just be discarded by the next weekly sync.
alter table public.leave_ledger_entries enable row level security;
alter table public.leave_ledger_types enable row level security;

-- leave_ledger_types is non-sensitive lookup data (just code/label/category)
-- needed to resolve labels for every tier below, including an employee
-- viewing their own leave -- open to any authenticated user rather than
-- tiered, since restricting it would silently null out the embedded
-- `leave_type` join on an otherwise-authorized leave_ledger_entries row.
create policy "Authenticated users can view leave types" on public.leave_ledger_types
for select to authenticated
using (true);

-- Four permissive SELECT policies on leave_ledger_entries, OR'd together by
-- Postgres automatically -- a row is visible if ANY of them match.

-- Tier 1: self -- powers "My Leaves" (an employee's own leave history).
create policy "Employees can view own leave records" on public.leave_ledger_entries
for select to authenticated
using (
    employee_id = public.current_employee_id()
);

-- Tier 2: superadmin -- sees everything, no department/manager restriction.
create policy "Superadmin can view all leave records" on public.leave_ledger_entries
for select to authenticated
using (
    public.is_superadmin()
);

-- Tier 3: HR department -- sees everything (this is the table backing the
-- HR Leave Management page's full list).
create policy "HR can view all leave records" on public.leave_ledger_entries
for select to authenticated
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    )
);

-- Tier 4: direct manager -- mirrors supabase/policies/manager_crud.sql's
-- attendance_activities pattern exactly (same "this employee's manager_id
-- points at me" shape), rewritten against current_employee_id() instead of
-- that file's inline repeated subquery. Direct reports only, not a
-- transitive hierarchy walk -- matches this app's existing manager-scoped
-- policies/authorization checks elsewhere (e.g. approve_attendance.sql).
create policy "Managers can view subordinates' leave records" on public.leave_ledger_entries
for select to authenticated
using (
    exists (
        select 1 from public.employees sub
        where sub.id = leave_ledger_entries.employee_id
          and sub.manager_id = public.current_employee_id()
    )
);
