-- Run this once in the Supabase SQL editor, AFTER current_employee_id.sql
-- and current_employee_manager_id.sql have both been deployed.
--
-- public.employees currently has exactly 3 policies (confirmed live via
-- docs/TABLE-POLICIES.csv): self ("Enable users to view their own data
-- only", profile_id = auth.uid()), "HR CRUD" (department_id = 7), and
-- "Only Superadmin can CRUD". There is no manager-tier policy at all.
--
-- This was never a problem before because every attendance/reporting
-- surface reads through unified_daily_attendance/attendance_activity_audit,
-- two plain views that run as their owner and bypass RLS entirely (no
-- security_invoker). The moment those views are switched to
-- security_invoker = on (see enable_attendance_views_security_invoker.sql),
-- a manager querying Team Attendance would only pass this table's RLS for
-- their own single row -- expected_shifts' "FROM public.employees e" roster
-- query would return zero rows for their direct reports, silently breaking
-- Team Attendance for every non-HR/superadmin manager.
--
-- Deploy this BEFORE flipping security_invoker on those views, not after.

-- Tier: direct manager -- lets a manager's own attendance/reporting queries
-- see their direct reports' employees rows once RLS actually applies.
create policy "Managers can view their direct reports" on public.employees
for select to authenticated
using (
    manager_id = public.current_employee_id()
);

-- Secondary, lower-severity fix: without this, a self-service employee's
-- own manager_id -> employees join (e.g. unified_daily_attendance's
-- manager_name column) would resolve to NULL once security_invoker is on,
-- since nothing today lets an employee see their own manager's row. Not
-- required for get_attendance_dashboard/get_hr_reports_dashboard (neither
-- RPC surfaces manager_name), but needed for the raw-view List/Card pages
-- (select("*")) to keep showing a manager's name to a self-service viewer.
create policy "Employees can view their own manager's record" on public.employees
for select to authenticated
using (
    id = public.current_employee_manager_id()
);
