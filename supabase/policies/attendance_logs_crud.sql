-- Run this in the Supabase SQL editor. SAFE TO RE-RUN -- every policy is
-- `drop policy if exists` + `create policy`, so pasting the whole file is
-- idempotent. (It was originally write-once, which made re-running it fail
-- with 42710 "policy already exists" the first time it needed amending.)
--
-- attendance_logs has RLS enabled, so a direct client SELECT returns only
-- what these policies allow. It was created with RLS on and ZERO policies,
-- which silently returned nothing to everyone -- fine at the time, because
-- every attendance surface read through unified_daily_attendance /
-- attendance_activity_audit, and those views then ran as their owner and
-- bypassed RLS entirely.
--
-- THAT IS NO LONGER TRUE. Both views now declare `security_invoker = on`
-- inline (see hr_unified_daily_attendance_view.sql), so these policies are
-- evaluated, as the calling user, for every base-table row those views touch.
-- They are on the hot path for every attendance page -- which is why the
-- performance note below matters as much as the access rules do.
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

-- ---------------------------------------------------------------------------
-- REWRITTEN 2026-09-22 FOR PERFORMANCE -- same rules, evaluated once per query
-- instead of once per row.
--
-- Tiers 1 and 4 were CORRELATED subqueries: they referenced
-- attendance_logs.employee_id inside the EXISTS, so their result genuinely
-- differed per row and the planner could not hoist them -- no volatility
-- marker on the helper functions could help. unified_daily_attendance scans
-- ~52,000 attendance_logs rows per request and runs security_invoker = on, so
-- these were re-executed tens of thousands of times per page load. A
-- year-to-date query crossed the statement timeout outright.
--
-- Each is restated so the expensive part is UNCORRELATED -- a scalar or a set
-- Postgres computes once as an InitPlan, then applies per row as a plain
-- equality or hash lookup. Tiers 2/3/5 were never correlated; they are wrapped
-- in `(select ...)` to force an InitPlan rather than trusting the planner to
-- hoist them.
--
-- NO TIER IS ADDED, REMOVED, WIDENED OR NARROWED. Policy names are unchanged.
-- ---------------------------------------------------------------------------

-- Tier 1: self -- an employee can see their own raw scan log.
--
-- Was: EXISTS (an employees row whose code matches THIS log and is me).
-- Now: does THIS log's code equal MY code, resolved once?
--
-- The subquery filters on employees.id, the primary key, so it returns at most
-- one row and cannot raise "more than one row returned". A caller with no
-- employees row yields NULL, and `employee_id = NULL` is NULL rather than
-- true, so the row stays hidden -- identical to EXISTS returning false.
drop policy if exists "Employees can view own scan logs" on public.attendance_logs;
create policy "Employees can view own scan logs" on public.attendance_logs
for select to authenticated
using (
    attendance_logs.employee_id = (
        select e.employee_id
        from public.employees e
        where e.id = (select public.current_employee_id())
    )
);

-- Tier 2: superadmin -- sees everything, no department/manager restriction.
drop policy if exists "Superadmin can view all scan logs" on public.attendance_logs;
create policy "Superadmin can view all scan logs" on public.attendance_logs
for select to authenticated
using (
    (select public.is_superadmin())
);

-- Tier 3: HR department -- sees everything (mirrors the HR Attendance
-- Management page's existing full-roster access).
drop policy if exists "HR can view all scan logs" on public.attendance_logs;
create policy "HR can view all scan logs" on public.attendance_logs
for select to authenticated
using (
    (select exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid()) and profiles.department_id = 7
    ))
);

-- Tier 4: direct manager -- direct reports only, mirrors
-- leave_ledger_crud.sql's own manager tier exactly.
-- Was: EXISTS (a subordinate whose code matches THIS log).
-- Now: is THIS log's code in the set of MY subordinates' codes, built once?
--
-- `x IN (set)` and the old EXISTS select the same rows. A NULL in the set
-- makes non-matching rows evaluate to NULL rather than false -- still not
-- true, so they stay hidden. The failure direction is toward showing LESS.
drop policy if exists "Managers can view subordinates' scan logs" on public.attendance_logs;
create policy "Managers can view subordinates' scan logs" on public.attendance_logs
for select to authenticated
using (
    attendance_logs.employee_id in (
        select sub.employee_id
        from public.employees sub
        where sub.manager_id = (select public.current_employee_id())
    )
);
