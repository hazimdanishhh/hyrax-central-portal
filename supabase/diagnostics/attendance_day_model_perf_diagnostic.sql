-- ############################################################################
-- PERFORMANCE DIAGNOSTIC -- unified_daily_attendance, after the Ship 1 rebuild.
--
-- Read-only apart from STEP 1 (a cache reload) and STEP 4 (which creates and
-- then drops a second copy of the old view). Safe to run on production.
--
-- Run each STEP as its own paste. The Supabase editor shows only the last
-- statement's result.
--
-- CONTEXT: after the day-model rebuild, every attendance page, both sidebars
-- and Payroll Export return correct data but are reported as drastically
-- slower. Diffing the deployed definition against the pre-rebuild one ruled
-- out the three structural causes -- see
-- docs/setup/ATTENDANCE-DAY-MODEL-DEPLOYMENT-GUIDE.md section 2. This file
-- measures rather than infers.
-- ############################################################################


-- ============================================================================
-- STEP 1 -- RELOAD THE POSTGREST SCHEMA CACHE. Try this FIRST.
--
-- DROP + CREATE gave both views new OIDs, which invalidates PostgREST's schema
-- cache and every cached plan built against them. Supabase usually reloads on
-- DDL automatically, but it is not guaranteed and this is instant and free.
--
-- After running it, re-test the pages. If they are fast again, stop -- nothing
-- below is needed.
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- STEP 2 -- TIME THE TWO SHAPES THE FRONTEND ACTUALLY ISSUES.
--
-- Run each EXPLAIN separately and keep the output. What matters:
--   * "Execution Time" at the bottom
--   * any "CTE Scan" node -- a materialized CTE that was supposed to inline
--   * any "Seq Scan on attendance_logs" -- the spine failing to prune
--   * a huge row count early in the plan -- the cross join not being filtered
-- ============================================================================

-- 2a. DAY MODE -- one calendar day's roster. This is what Attendance
-- Management, My Attendance and Team Attendance issue by default
-- (fetchUnifiedAttendance: .eq("work_date", date), no row pagination).
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.unified_daily_attendance
WHERE work_date = CURRENT_DATE - 1
ORDER BY full_name, work_date DESC, employee_uuid;

-- 2b. SEARCH MODE -- a date range, row-paginated. This is what the lists
-- switch to once any SEARCH_MODE_FILTER_KEYS filter is set
-- (fetchUnifiedAttendanceSearch).
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.unified_daily_attendance
WHERE work_date >= CURRENT_DATE - 30 AND work_date <= CURRENT_DATE
ORDER BY full_name, work_date DESC, employee_uuid
LIMIT 100 OFFSET 0;

-- 2c. THE RECONCILIATION FILTER -- needs_reconciliation lives in the OUTER
-- select, so the whole view must be built before this predicate can apply.
-- That was true before the rebuild too, but it is the most expensive filter
-- the lists offer and worth measuring on its own.
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.unified_daily_attendance
WHERE work_date >= CURRENT_DATE - 30 AND work_date <= CURRENT_DATE
  AND needs_reconciliation = true
ORDER BY full_name, work_date DESC, employee_uuid
LIMIT 100 OFFSET 0;

-- 2d. THE DAY SIDEBAR -- attendance_activity_audit, scoped to one
-- employee-day (fetchEmployeeDayDetails). This view gained an
-- employment_status join in the rebuild, so it is the one place a new join
-- was actually added.
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.attendance_activity_audit
WHERE work_date = CURRENT_DATE - 1
LIMIT 50;


-- ============================================================================
-- STEP 3 -- IS THE COST IN THE VIEW, OR IN THE COLUMNS?
--
-- If 3a is fast and 2a is slow, the cost is in producing the wide row (the
-- axis columns, day_state, the approved_* arithmetic), not in the joins.
-- If both are slow, the cost is in the joins/spine and the new columns are
-- innocent.
-- ============================================================================
EXPLAIN (ANALYZE, BUFFERS)
SELECT employee_uuid, work_date FROM public.unified_daily_attendance
WHERE work_date = CURRENT_DATE - 1;


-- ============================================================================
-- STEP 4 -- ATTRIBUTE IT. Build the OLD definition side by side and time the
-- same query against both.
--
-- This is the only step that answers "is the rebuild responsible" rather than
-- inferring it. Paste the PRE-REBUILD definition in place of the placeholder
-- below -- get it with:
--
--   git show 5109aa0~1:supabase/sql_editor/hr_unified_daily_attendance_view.sql
--
-- Change its first line to:
--   CREATE VIEW public.unified_daily_attendance_old WITH (security_invoker = on) AS
--
-- It reads the same base tables, so it is safe alongside the live view. RLS
-- still applies. Nothing in the app knows it exists.
-- ============================================================================

-- <<< PASTE THE OLD DEFINITION HERE, RENAMED TO unified_daily_attendance_old >>>

-- Then time both. Expect these to be within noise of each other; a large gap
-- is the rebuild's fault and the plans from STEP 2 will say where.
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM public.unified_daily_attendance_old
-- WHERE work_date = CURRENT_DATE - 1
-- ORDER BY full_name, work_date DESC, employee_uuid;

-- Clean up when done -- do NOT leave this view in place. It has no
-- security_invoker guarantee going forward, nothing maintains it, and it will
-- silently rot into a second source of truth.
-- DROP VIEW IF EXISTS public.unified_daily_attendance_old;


-- ============================================================================
-- STEP 5 -- BASELINE HYGIENE, unrelated to the rebuild but worth ruling out.
--
-- If the base tables have not been analyzed recently the planner may be
-- choosing badly for reasons that have nothing to do with the view. Cheap,
-- safe, and rules out a whole class of false leads.
-- ============================================================================
-- ANALYZE public.attendance_logs;
-- ANALYZE public.attendance_activities;
-- ANALYZE public.leave_ledger_entries;
-- ANALYZE public.employees;
-- ANALYZE public.public_holidays;

-- Row counts and last-analyze times, to see whether that is even plausible:
SELECT relname,
       n_live_tup,
       last_analyze,
       last_autoanalyze
FROM pg_stat_user_tables
WHERE relname IN ('attendance_logs','attendance_activities','leave_ledger_entries',
                  'employees','public_holidays','attendance_reconciliation_acknowledgements')
ORDER BY n_live_tup DESC;
