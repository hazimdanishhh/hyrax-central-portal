-- Run this once in the Supabase SQL editor.
--
-- Context: HR Reports (/app/hr/reports, HRReports.jsx) is already correctly
-- gated end-to-end at the route (HRRoutes.jsx: departments={["HR","MGM"]}
-- roles={["manager"]}), nav/dashboard-card (sideNavLinkData.js/
-- departmentLinkCardData.js, same gate), and RPC level
-- (get_hr_reports_dashboard_rpc.sql's own in-body guard: superadmin or a
-- manager in HR/MGM). Its drill-through links (HRReports.jsx's
-- canAccessHrOps, overviewConfig.js's employeesTo/attendanceTo/
-- onboardingTo/offboardingTo) are ALSO already correct -- deliberately
-- HR-only, never MGM, so an MGM viewer sees a plain number, never a dead
-- link into a page they can't open. None of that is being changed here --
-- this file is NOT the Finance/Sales pattern (company-wide MGM route
-- access); Employees/Attendance/Leave/Onboarding/Offboarding stay HR-only
-- pages, by design, per the user's explicit instruction.
--
-- The actual, only gap: get_hr_reports_dashboard_rpc.sql runs SECURITY
-- INVOKER (no `security definer` in the function definition), so its own
-- guard only decides who may CALL it -- the rows it can actually return are
-- separately gated by each underlying table's own RLS, evaluated as the
-- calling user. A full live audit (2026-09) found none of the five tables
-- this RPC reads directly (employees, leave_ledger_entries, attendance_logs,
-- attendance_activities -- the latter two feed the unified_daily_attendance
-- view this RPC also reads directly -- and employee_lifecycle_cases) has
-- any MGM-visible policy at all, only self/HR-department(department_id=7)/
-- direct-manager/superadmin tiers. Result: an MGM manager who passes the
-- RPC's own guard still gets back an effectively empty dashboard, since
-- their session can't see any of the underlying rows.
--
-- Deliberately MANAGER-GATED, not company-wide (unlike
-- mgm_finance_access_parity_fix.sql/mgm_sales_access_parity_fix.sql's
-- "MGM Department VIEW" template): the ONLY legitimate path an MGM viewer
-- has into any of these five tables is HR Reports itself, which is
-- manager-gated at both the route and the RPC guard. Granting a
-- company-wide policy here would let a non-manager MGM staffer read raw
-- employee/attendance/leave/lifecycle-case rows directly via the REST API,
-- bypassing a restriction the frontend and RPC both deliberately enforce --
-- this data is materially more sensitive (personal employee records) than
-- the Sales/Finance SAP-mirror documents those company-wide fixes covered.
-- Named "MGM Manager VIEW" (not "MGM Department VIEW") to keep that
-- distinction visible at a glance, matching
-- supabase/policies/sales_targets_budgets_crud.sql's own "MGM Manager CRUD"
-- naming for the same manager-gated-only reasoning.
--
-- employee_lifecycle_case_items (the onboarding/offboarding checklist-item
-- detail table, sibling to employee_lifecycle_cases) is included too even
-- though this RPC only reads the parent case shell today -- same access
-- surface, so it's a gap in waiting the moment any future HR Reports
-- drill-in needs it.
--
-- Idempotent: each block drops its own policy by name first, so this is
-- safe to re-run.

-- === employees ===
drop policy if exists "MGM Manager VIEW" on public.employees;
create policy "MGM Manager VIEW" on public.employees
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM' and r.name = 'manager'
  )
);

-- === leave_ledger_entries ===
drop policy if exists "MGM Manager VIEW" on public.leave_ledger_entries;
create policy "MGM Manager VIEW" on public.leave_ledger_entries
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM' and r.name = 'manager'
  )
);

-- === attendance_logs ===
-- Wrapped in `(select ...)` 2026-09-22 so Postgres evaluates it ONCE as an
-- InitPlan instead of per row. attendance_logs is the hot table here:
-- unified_daily_attendance scans ~52,000 of its rows per request under
-- security_invoker, and every SELECT policy on the table is tested against
-- each one. The condition was never correlated, so this is purely a planner
-- hint -- the rule is unchanged. See attendance_logs_crud.sql for the full
-- explanation and the two policies that needed real restructuring.
drop policy if exists "MGM Manager VIEW" on public.attendance_logs;
create policy "MGM Manager VIEW" on public.attendance_logs
for select to authenticated
using (
  (select exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = (select auth.uid()) and d.sub = 'MGM' and r.name = 'manager'
  ))
);

-- === attendance_activities ===
drop policy if exists "MGM Manager VIEW" on public.attendance_activities;
create policy "MGM Manager VIEW" on public.attendance_activities
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM' and r.name = 'manager'
  )
);

-- === employee_lifecycle_cases ===
drop policy if exists "MGM Manager VIEW" on public.employee_lifecycle_cases;
create policy "MGM Manager VIEW" on public.employee_lifecycle_cases
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM' and r.name = 'manager'
  )
);

-- === employee_lifecycle_case_items (not read by get_hr_reports_dashboard
-- today, included for the reason in the header comment above) ===
drop policy if exists "MGM Manager VIEW" on public.employee_lifecycle_case_items;
create policy "MGM Manager VIEW" on public.employee_lifecycle_case_items
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM' and r.name = 'manager'
  )
);
