-- Run this once in the Supabase SQL editor, AFTER current_employee_id.sql
-- has been deployed.
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
--
-- Only one tier is needed -- confirmed with the user: My Attendance is
-- scoped to the viewer's own attendance only, and Team Attendance is scoped
-- to the manager's own direct reports only. Neither page (nor either RPC)
-- ever needs a self-service employee to see their OWN manager's employees
-- row -- unified_daily_attendance.manager_name (the one column that join
-- would feed) has zero frontend consumers (confirmed by repo-wide grep), so
-- a second "Employees can view their own manager's record" policy would
-- grant real access for no product need. Not added.

-- Tier: direct manager -- lets a manager's own attendance/reporting queries
-- see their direct reports' employees rows once RLS actually applies.
create policy "Managers can view their direct reports" on public.employees
for select to authenticated
using (
    manager_id = public.current_employee_id()
);
