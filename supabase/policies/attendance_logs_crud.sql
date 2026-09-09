-- Run this once in the Supabase SQL editor.
--
-- attendance_logs has had RLS enabled with zero policies since it was
-- created (see docs/TABLE-POLICIES.csv) -- meaning a direct client SELECT
-- has always silently returned nothing. This was never a problem before
-- because every existing attendance surface reads through
-- unified_daily_attendance/attendance_activity_audit, two plain views that
-- run as their owner and bypass RLS entirely (no security_invoker) -- but
-- the new scan-log verification feature (get_attendance_log_scans.sql)
-- needs a direct query against this table, which needs real policies to
-- work at all.
--
-- Same 4-tier shape as leave_ledger_crud.sql (self / superadmin / HR
-- department / direct manager), the established pattern for this exact
-- kind of per-employee attendance data in this app. Bridged through
-- employees.employee_id (the text scanner code attendance_logs.employee_id
-- actually stores) since it isn't the employees.id uuid
-- current_employee_id() returns.
--
-- SELECT-only: the only writer is vigilance_iot, via its
-- SUPABASE_SERVICE_ROLE_KEY (bypasses RLS entirely, unaffected by any of
-- this) -- no INSERT/UPDATE/DELETE policy is needed or wanted for
-- `authenticated`.
alter table public.attendance_logs enable row level security;

-- Tier 1: self -- an employee can see their own raw scan log.
create policy "Employees can view own scan logs" on public.attendance_logs
for select to authenticated
using (
    exists (
        select 1 from public.employees e
        where e.employee_id = attendance_logs.employee_id
          and e.id = public.current_employee_id()
    )
);

-- Tier 2: superadmin -- sees everything, no department/manager restriction.
create policy "Superadmin can view all scan logs" on public.attendance_logs
for select to authenticated
using (
    public.is_superadmin()
);

-- Tier 3: HR department -- sees everything (mirrors the HR Attendance
-- Management page's existing full-roster access).
create policy "HR can view all scan logs" on public.attendance_logs
for select to authenticated
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    )
);

-- Tier 4: direct manager -- direct reports only, mirrors
-- leave_ledger_crud.sql's own manager tier exactly.
create policy "Managers can view subordinates' scan logs" on public.attendance_logs
for select to authenticated
using (
    exists (
        select 1 from public.employees sub
        where sub.employee_id = attendance_logs.employee_id
          and sub.manager_id = public.current_employee_id()
    )
);
