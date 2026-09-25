-- get_attendance_dashboard: backs the HR Attendance Overview page
-- (src/pages/user/hr/attendanceManagement/overview/AttendanceOverview.jsx).
--
-- Tier-2 Overview RPC (single entity: Attendance), mirroring
-- get_hr_employees_dashboard's shape/conventions exactly (see that file and
-- DASHBOARD-CONVENTIONS.md §3). Built as CTEs directly over
-- unified_daily_attendance, reusing its already-correct reconciliation
-- logic (hr_flag/hours_worked) instead of re-deriving it a second time here.
--
-- p_employee_id scopes every period-bound figure/chart to one employee --
-- this is what lets the same Overview page double as "attendance analytics
-- for one employee over a period" (e.g. for payroll prep) without a second,
-- bespoke page. Per the user's decision, Attendance keeps its own separate
-- Overview+List submodule (matching Employees/IT Assets) rather than being
-- folded into Employee Management -- this filter is what gives it the
-- per-employee angle that would otherwise be the reason to fold it in.
--
-- Filter matching + "This Month" default (2026-09-25, per the user's
-- decision -- think of it as three questions: what does HR need to see the
-- moment they open this page with no filters at all; what happens once they
-- narrow to a department/employee/work location; what happens once they also
-- pick a date range):
--
--   1. NO FILTERS AT ALL: every REGULAR metric (Attendance Rate -- which
--      Absenteeism/Absent Days folded into, 2026-09-25 -- Check-In/Check-Out,
--      Workload, Leave) defaults to the FULL CURRENT MONTH (1st through the
--      last day, not month-to-date/1st-through-today) -- a sensible, bounded
--      snapshot, not an unbounded multi-year scan, and one that lets the
--      previous-period delta compare against a complete previous month
--      rather than a truncated one (see step 1's own comment). Every
--      ACTIONABLE metric
--      (Pending Approvals, Missing Check-Outs, Incomplete Card Scans, Needs
--      Reconciliation, Leave Conflict) instead shows the TRUE CURRENT
--      BACKLOG, unbounded by date -- HR needs to see everything still
--      outstanding the moment they land on the page, not just what happened
--      to originate this month. (Incomplete Card Scans used to be its own
--      case, defaulting to TODAY specifically -- moved into this same family
--      2026-09-25 so data-quality gaps behave identically to reconciliation
--      items, not a special case.)
--   2. DEPARTMENT/EMPLOYEE/MANAGER/WORK LOCATION FILTER: every metric above,
--      regular or actionable, narrows to that department/employee/manager/
--      work location -- these filters always apply, with no exception.
--   3. DATE RANGE ALSO PICKED: every metric, including the actionable ones,
--      now switches to reflect exactly that period -- once HR is looking at
--      a specific range, "what originated in that range" (not "what's
--      outstanding right now") is the useful question, e.g. for a
--      historical audit of a past payroll cycle.
--
-- v_has_period (declared below) drives every regular/actionable metric's own
-- backlog-vs-period switch; period_rows itself reads v_effective_start_date/
-- v_effective_end_date, which default to the full current month (unrelated
-- to v_has_period -- it's simply what "the selected period, defaulting to
-- the full current month" means for the regular metrics that always read
-- from it). The previous-period calculation (step 1) now always runs, using
-- that same effective range, so prev_period_rows/prev_employee_leave_rows
-- are never intentionally empty anymore -- an unfiltered call correctly
-- compares the full current month against the full previous month, not
-- "no comparison available".
--
-- Avg Approval Turnaround / Oldest Pending Approval / the unapproved-app-
-- hours-delta component of needs_reconciliation were computed here at one
-- point but never displayed anywhere in the frontend -- removed 2026-09-25
-- rather than kept as dead calculations. Re-add if a real UI need for them
-- comes back. (An is_unacknowledged_absent version of the Needs
-- Reconciliation tile's Absent row was tried in that same pass, then
-- dropped the same day per the user's own call: an absence is considered
-- needing reconciliation regardless of any separate acknowledgement state,
-- so v_absent_backlog_count below deliberately reads the plain day_state =
-- 'absent' fact -- the exact same one Attendance Rate's own Absent Days
-- sub-metric reads. The only difference between the two is which window
-- each applies: this tile's own backlog-vs-period rule here, This-Month/
-- period there.)
--
-- KPI/metric selection ("Pass 2", metrics-expansion pass): cross-referenced
-- against hyrax-data-platform/docs/sap-data-architecture-plans/
-- 02-department-kpi-frameworks.md's HR/Workforce section (the same
-- authoritative target-KPI doc Sales/Finance Reports were built against).
-- Headcount/Attrition/Tenure already live on Employee Overview (not
-- duplicated here); Attendance Rate/Absenteeism Rate already matched
-- doc-02's own formulas exactly from Pass 1. This pass adds the two named
-- gaps doc-02 calls out (Overtime Hours, WFH-vs-office split -- here
-- "Work Channel Mix", since Hyrax's version is Hardware-scan-vs-App, not
-- literally home-vs-office) plus the user's own explicit asks (average
-- check-in/check-out, early leave) and a strengthened Pending Approvals
-- tile (turnaround time, not just a raw count). Training Hours stays
-- explicitly blocked (doc-02 itself: no fact table/SAP source exists for it).
--
-- Tile segmentation ("Pass 3"): the Overview page's 8 KPI tiles (matching
-- Employee Overview's own tile count) are grouped by what they actually
-- measure, not just "whatever fit" -- Today's Snapshot (Attendance Rate,
-- Pending Approvals, Attendance Anomalies), Punctuality (Average Check-In
-- w/ Late Arrivals, Average Check-Out w/ Early Leave -- each anomaly lives
-- on the tile whose own metric it's derived from), Workload (Average Hours
-- Worked, Overtime Hours), and Absenteeism Rate. Missing-Check-Out/
-- Incomplete-Card-Scans used to sit under Pending Approvals despite being a
-- different anomaly class entirely (approval workflow vs. data-quality
-- exceptions) -- split into their own Attendance Anomalies tile instead,
-- same "sum of sub-metrics as headline" pattern Employee Overview's own HR
-- Actions Needed tile already uses.
--
-- History ("Pass 4", refined 2026-09-25 into the rule above): this RPC used
-- to compute Attendance Rate/Pending Approvals/Attendance Anomalies from
-- literal work_date = current_date, regardless of any period filter. A real
-- bug surfaced while fixing that: hr_flag values like 'Pending App Approval'/
-- 'Missing App Check-Out' are anchored to the day the *original activity*
-- was clocked in, not to today -- an activity clocked in 3 days ago that's
-- still pending/still has no checkout never appeared in a
-- `work_date = current_date` query, so the old "Pending Approvals" count
-- silently excluded any backlog older than today. That's the origin of
-- pending_activity_rows/open_session_rows' unbounded-by-date backlog design,
-- which the 2026-09-25 pass above generalized to Needs Reconciliation/Leave
-- Conflict too, and made ATTENDANCE RATE STOP using "today" altogether
-- (it's a regular metric now -- This Month by default, exactly the selected
-- period once one is chosen, never a live snapshot).
--
-- OVERLOAD WARNING: `create or replace function` only replaces a function
-- whose parameter signature is identical. Adding/removing a parameter here
-- creates a SECOND overloaded function instead of replacing this one --
-- PostgREST then can't resolve which one a caller means (PGRST203,
-- "Could not choose the best candidate function") the moment a call omits
-- the new parameter, since it then matches both signatures. Confirmed live
-- 2026-08 when p_manager_id was added. Whenever this parameter list changes,
-- also run `DROP FUNCTION public.get_attendance_dashboard(<old signature>);`
-- in Supabase Studio for every prior signature before/after redeploying.
create or replace function get_attendance_dashboard(
    p_start_date    date default null,
    p_end_date      date default null,
    p_department_id bigint default null,
    p_employee_id   uuid default null,
    -- Team Attendance Overview scope -- mirrors p_employee_id's shape
    -- exactly, added to every CTE below. unified_daily_attendance already
    -- carries manager_id directly; the CTEs that query attendance_activities
    -- raw already join employees e, so e.manager_id is available there too.
    -- Null (every existing HR/My-Attendance caller) leaves behavior
    -- unchanged.
    p_manager_id    uuid default null,
    -- Work Location filter (added for the work_locations rollout, see
    -- docs/WORK-LOCATIONS-ARCHITECTURE.md) -- mirrors p_department_id's
    -- exact null-passthrough shape in every CTE below. OVERLOAD WARNING
    -- applies here too: run DROP FUNCTION on the prior 5-param signature
    -- before redeploying this 6-param one.
    p_work_location_id bigint default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_interval integer;
    -- The REGULAR family's actual effective range -- 2026-09-25: previously
    -- each CTE independently coalesced p_start_date/p_end_date inline
    -- (month-to-date: 1st of the month through TODAY when unfiltered).
    -- Computed once here instead so the previous-period calculation below
    -- can use the SAME effective range the regular metrics themselves use,
    -- not just the raw (possibly both-null) params -- see v_prev_start_date/
    -- v_prev_end_date's own comment for why that matters. Defaults to the
    -- FULL current month (1st through the last day), not month-to-date: an
    -- in-progress month should still compare against a complete previous
    -- month, not a partial one.
    v_effective_start_date date;
    v_effective_end_date date;
    v_prev_start_date date;
    v_prev_end_date date;
    v_trend_bucket text;
    -- Drives every regular/actionable metric's own backlog-vs-period switch
    -- (see header comment). Same test already used for prev_period_rows.
    v_has_period boolean;
    -- Needs Reconciliation / Leave Conflict's own backlog-vs-period figures
    -- (see the pre-computation block below, right after v_has_period is
    -- set) -- computed once here via a plpgsql variable rather than a CTE
    -- referenced from a `case when v_has_period` branch, specifically to
    -- avoid ALWAYS paying for both an unbounded scan (the backlog case) AND
    -- a period_rows scan (the filtered case) on every single call regardless
    -- of which one the caller actually needs -- a CTE referenced anywhere in
    -- the final query gets materialized unconditionally, a plpgsql
    -- if/else does not.
    v_needs_reconciliation_count bigint;
    v_leave_conflict_count bigint;
    -- Absent, backlog-scoped -- deliberately the SAME plain day_state =
    -- 'absent' fact Attendance Rate's own Absent Days sub-metric uses (not
    -- is_unacknowledged_absent -- per the user's own call, an absence is
    -- considered needing reconciliation regardless of any separate
    -- acknowledgement flag, so no new filter/column distinction is needed).
    -- The only difference from Attendance Rate's version is which window it
    -- reads: this follows the tile's own backlog-vs-period rule (is this
    -- still outstanding right now), Attendance Rate follows This-Month/
    -- period (how many absences happened this month). Same underlying
    -- column, two different time windows, both meaningful.
    v_absent_backlog_count bigint;
    -- 2 of needs_reconciliation's own 5 real components
    -- (hr_unified_daily_attendance_view.sql) that the Needs Reconciliation
    -- tile's sub-metrics are actually built from. (The unapproved-app-hours
    -- delta was computed here too at one point but never surfaced anywhere
    -- in the frontend; removed 2026-09-25 rather than left as a dead
    -- calculation.) Same pre-computation, same reasoning as
    -- v_needs_reconciliation_count above.
    v_insufficient_half_day_count bigint;
    v_leave_fraction_error_count bigint;
    -- Incomplete Card Scans -- 2026-09-25: moved into this same backlog-vs-
    -- period family as Missing Check-Outs/Needs Reconciliation (was
    -- previously its own special case, defaulting to TODAY specifically --
    -- see the removed today_rows CTE). Data quality gaps should behave
    -- identically to reconciliation items: the true current backlog when
    -- unfiltered, exactly the selected period once one is chosen -- an
    -- incomplete scan from 3 days ago still needs the same follow-up
    -- regardless of which date range HR happens to be looking at.
    v_incomplete_scans_count bigint;
    -- Top Needs Reconciliation / Top Data Quality Issues leaderboards (added
    -- 2026-09-25, chart restructuring pass) -- per-employee counterpart to
    -- v_needs_reconciliation_count/v_incomplete_scans_count above, same
    -- backlog-vs-period if/else pattern and same reasoning (avoid paying for
    -- both an unbounded per-employee scan and a period-bound one on every
    -- call), just a json array instead of a scalar.
    v_top_needs_reconciliation_data json;
    v_top_data_quality_data json;
    -- Authorization guard state -- see "0. Authorization guard" below.
    v_is_hr_or_superadmin boolean;
    v_caller_employee_id uuid;
begin

-- 0. Authorization guard (added for HR UAT hardening): this RPC itself has
-- no security_invoker/security definer clause, so it runs with the caller's
-- own privileges by Postgres's default -- but this function's body still
-- performs its OWN reads across departments/employees regardless of who
-- calls it, so RLS on the underlying tables alone is not enough to keep an
-- ordinary employee from calling this RPC directly (bypassing My Attendance/
-- Team Attendance/HR's own frontend scoping) and getting back every active
-- employee's present/absent/overtime/leave/anomaly data company-wide, just by
-- passing no filters. (unified_daily_attendance itself DOES declare
-- `security_invoker = on` -- hr_unified_daily_attendance_view.sql:83-84 --
-- correcting an earlier version of this comment that claimed otherwise.)
-- Mirrors the identical fix already applied to get_finance_dashboard for the
-- same root cause (see supabase/access-control/README.md) -- same helper functions
-- (public.is_superadmin(), public.current_employee_id()), same
-- errcode = '42501' convention.
--
-- HR/superadmin: unrestricted, exactly as before this guard existed.
-- Anyone else: only a genuinely self-scoped call (p_employee_id = their
-- own id, p_department_id/p_manager_id both null -- what My Attendance
-- always sends) or a genuinely manager-scoped call (p_manager_id = their
-- own id, p_department_id/p_employee_id both null -- what Team Attendance
-- always sends) is allowed. Every other combination, including the
-- all-null default that used to silently mean "company-wide", is rejected.
select (public.is_superadmin() or p.department_id = 7)
into v_is_hr_or_superadmin
from public.profiles p
where p.id = auth.uid();

v_caller_employee_id := public.current_employee_id();

if not coalesce(v_is_hr_or_superadmin, false) then
    if not (
        p_department_id is null
        and (
            (p_employee_id is not null and p_employee_id = v_caller_employee_id and p_manager_id is null)
            or
            (p_manager_id is not null and p_manager_id = v_caller_employee_id and p_employee_id is null)
        )
    ) then
        raise exception 'Unauthorized: get_attendance_dashboard requires HR/superadmin, or a call scoped to your own employee_id/manager_id' using errcode = '42501';
    end if;
end if;

-- 1. Effective range for the REGULAR family + previous-period calculation
-- for deltas (mirrors get_hr_employees_dashboard's own interval approach).
-- 2026-09-25: this used to only run when the caller explicitly sent BOTH
-- dates, leaving prev_period_rows/prev_employee_leave_rows permanently
-- empty (by their own WHERE clause) on every unfiltered call -- meaning no
-- "vs last period" delta ever appeared on first page load, only once a user
-- explicitly picked a range. Now always computed, using the SAME effective
-- range period_rows/employee_leave_rows read below -- an in-progress month
-- correctly compares against the FULL previous month
-- (same day-count-based interval as any explicit filter), not a truncated
-- one.
v_effective_start_date := coalesce(p_start_date, date_trunc('month', current_date)::date);
v_effective_end_date := coalesce(p_end_date, (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date);

v_interval := v_effective_end_date - v_effective_start_date;
v_prev_end_date := v_effective_start_date - 1;
v_prev_start_date := v_prev_end_date - v_interval;

-- Drives the ACTIONABLE family's backlog-vs-period switch (see header
-- comment) -- deliberately still the RAW params, not v_effective_*: whether
-- the CALLER explicitly picked a range is what actionable metrics care
-- about, independent of whatever implicit default the regular family now
-- resolves to.
v_has_period := (p_start_date is not null and p_end_date is not null);

-- 1a. Needs Reconciliation and its real components -- computed here, once,
-- via a plain if/else rather than a `case when v_has_period` branch inside
-- the main query below (see v_needs_reconciliation_count's own declaration
-- comment for why: this avoids ever running BOTH the unbounded backlog scan
-- and a period_rows-equivalent scan on the same call). The filtered branch
-- necessarily re-reads unified_daily_attendance with the same bound
-- period_rows itself will also apply below -- a small, deliberate
-- redundancy (bounded by the selected range, typically cheap) traded for
-- guaranteeing the unbounded branch below only ever runs when it's actually
-- the one being used.
--
-- needs_reconciliation itself is the OR of 5 conditions
-- (hr_unified_daily_attendance_view.sql) -- 2 of them (leave conflict,
-- insufficient half-day) counted here since the Needs Reconciliation tile's
-- sub-metrics are built from them. has_leave_fraction_error is also counted
-- (its own sub-metric was removed from the frontend 2026-09-25, but the
-- calculation itself was left as-is, not part of that cleanup).
-- day_state = 'absent' isn't one of the 5 either (is_unacknowledged_absent
-- is, but the tile deliberately uses the plain fact instead -- see
-- v_absent_backlog_count's own declaration comment), and neither is
-- evidence_quality (Incomplete Card Scans) -- both join this same
-- pre-computation because they need the identical backlog-vs-period
-- behavior, not because they're formula components.
if v_has_period then
    select
        count(*) filter (where needs_reconciliation),
        count(*) filter (where is_leave_attendance_conflict),
        count(*) filter (where day_state = 'absent'),
        count(*) filter (where is_unacknowledged_insufficient_half_day),
        count(*) filter (where has_leave_fraction_error),
        count(*) filter (where evidence_quality in ('single_scan', 'single_scan_and_open_session'))
    into
        v_needs_reconciliation_count, v_leave_conflict_count,
        v_absent_backlog_count, v_insufficient_half_day_count,
        v_leave_fraction_error_count, v_incomplete_scans_count
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id)
    and uda.work_date >= p_start_date
    and uda.work_date <= p_end_date;
else
    -- The true current backlog -- unbounded by date on purpose (see header
    -- comment). Still capped in practice by unified_daily_attendance's own
    -- expected_shifts floor/ceiling (2 years back per employee's join date,
    -- 1 year forward), so this is a bounded-but-wide scan, not a literal
    -- full-table one -- comparable in cost to a full "This Year" query
    -- (~1s, per this repo's own diagnostics), paid once, only on an
    -- unfiltered call.
    select
        count(*) filter (where needs_reconciliation),
        count(*) filter (where is_leave_attendance_conflict),
        count(*) filter (where day_state = 'absent'),
        count(*) filter (where is_unacknowledged_insufficient_half_day),
        count(*) filter (where has_leave_fraction_error),
        count(*) filter (where evidence_quality in ('single_scan', 'single_scan_and_open_session'))
    into
        v_needs_reconciliation_count, v_leave_conflict_count,
        v_absent_backlog_count, v_insufficient_half_day_count,
        v_leave_fraction_error_count, v_incomplete_scans_count
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id);
end if;

-- 1b. Top Needs Reconciliation / Top Data Quality Issues leaderboards --
-- same backlog-vs-period switch and same filter set as 1a above.
--
-- PERFORMANCE FIX (2026-09-25, same day as this block was first added): the
-- original version ran TWO separate full unified_daily_attendance scans here
-- (one per leaderboard) on top of 1a's own scan -- three full scans of the
-- most expensive table in this RPC on every call, which is what made the
-- dashboard noticeably slower right after this pass shipped. Rewritten to a
-- single `with` CTE that scans the view ONCE per branch, computing both
-- leaderboards' per-employee counts in one pass; the two `into` targets then
-- each read from that same (already-tiny, one-row-per-employee) CTE result
-- instead of re-scanning the view. Three scans down to one.
if v_has_period then
    with employee_backlog as materialized (
        select uda.employee_uuid, uda.full_name,
               count(*) filter (where uda.needs_reconciliation) as reconciliation_count,
               count(*) filter (where uda.evidence_quality in ('single_scan', 'open_session', 'single_scan_and_open_session')) as data_quality_count
        from unified_daily_attendance uda
        where (p_department_id is null or uda.department_id = p_department_id)
        and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
        and (p_employee_id is null or uda.employee_uuid = p_employee_id)
        and (p_manager_id is null or uda.manager_id = p_manager_id)
        and uda.work_date >= p_start_date
        and uda.work_date <= p_end_date
        group by uda.employee_uuid, uda.full_name
    )
    select
        (select coalesce(json_agg(x order by x.value desc), '[]'::json)
         from (
             select full_name as name, reconciliation_count as value,
                    json_build_object('employee', employee_uuid) as filter
             from employee_backlog
             where reconciliation_count > 0
             order by reconciliation_count desc
             limit 10
         ) x),
        (select coalesce(json_agg(x order by x.value desc), '[]'::json)
         from (
             select full_name as name, data_quality_count as value,
                    json_build_object('employee', employee_uuid) as filter
             from employee_backlog
             where data_quality_count > 0
             order by data_quality_count desc
             limit 10
         ) x)
    into v_top_needs_reconciliation_data, v_top_data_quality_data;
else
    with employee_backlog as materialized (
        select uda.employee_uuid, uda.full_name,
               count(*) filter (where uda.needs_reconciliation) as reconciliation_count,
               count(*) filter (where uda.evidence_quality in ('single_scan', 'open_session', 'single_scan_and_open_session')) as data_quality_count
        from unified_daily_attendance uda
        where (p_department_id is null or uda.department_id = p_department_id)
        and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
        and (p_employee_id is null or uda.employee_uuid = p_employee_id)
        and (p_manager_id is null or uda.manager_id = p_manager_id)
        group by uda.employee_uuid, uda.full_name
    )
    select
        (select coalesce(json_agg(x order by x.value desc), '[]'::json)
         from (
             select full_name as name, reconciliation_count as value,
                    json_build_object('employee', employee_uuid) as filter
             from employee_backlog
             where reconciliation_count > 0
             order by reconciliation_count desc
             limit 10
         ) x),
        (select coalesce(json_agg(x order by x.value desc), '[]'::json)
         from (
             select full_name as name, data_quality_count as value,
                    json_build_object('employee', employee_uuid) as filter
             from employee_backlog
             where data_quality_count > 0
             order by data_quality_count desc
             limit 10
         ) x)
    into v_top_needs_reconciliation_data, v_top_data_quality_data;
end if;

-- 2. Trend-chart bucket size: day by default, week once the selected range
-- exceeds 60 days (e.g. "This Year") -- keeps the two trend charts readable
-- instead of rendering an unreadable ~250-point daily line. Both trend
-- charts below apply the same v_trend_bucket, so they never disagree.
v_trend_bucket := case
    when p_start_date is not null and p_end_date is not null and (p_end_date - p_start_date) > 60
    then 'week'
    else 'day'
end;

with
-- Period-bound rows, scoped by the same department/employee filters. Reads
-- v_effective_start_date/v_effective_end_date (computed in step 1 above),
-- which default to the FULL current month, not month-to-date, when the
-- caller sends no range at all -- see header comment's 3-question framing.
-- Every REGULAR metric (Attendance Rate, Check-In/Check-Out, Workload,
-- Leave) reads from this CTE and inherits that default; the ACTIONABLE
-- metrics (Pending Approvals, Missing Check-Outs, Incomplete Card Scans,
-- Needs Reconciliation, Leave Conflict) deliberately do NOT read from this
-- CTE when unfiltered -- they use their own true-backlog sources instead
-- (see pending_activity_rows/open_session_rows below and the
-- v_needs_reconciliation_count pre-computation above). Note SearchFilterBar's
-- own date-range presets always send an explicit range, so this default only
-- matters on a completely unfiltered first load.
-- MATERIALIZED: unified_daily_attendance is expensive (its own
-- active_company_dates CTE cross-joins every active employee against a
-- multi-year date spine). period_rows/prev_period_rows are each read by
-- ~15-20 separate scalar subqueries below -- without this hint the planner
-- is merely LIKELY (not guaranteed) to materialize a multiply-referenced
-- CTE rather than re-evaluating the whole view per reference; forcing it
-- removes that uncertainty entirely, so the view gets computed at most
-- once per period per call regardless of planner version/heuristics.
period_rows as materialized (
    select uda.*
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id)
    and uda.work_date >= v_effective_start_date
    and uda.work_date <= v_effective_end_date
),

-- Always populated now (2026-09-25 -- previously only when the caller sent
-- an explicit range, leaving this permanently empty otherwise and every
-- delta reading as "no comparison available" on an unfiltered load).
-- v_prev_start_date/v_prev_end_date are computed in step 1 from the SAME
-- effective range period_rows above uses, so an unfiltered call correctly
-- compares the full current month against the full previous month.
prev_period_rows as materialized (
    select uda.*
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id)
    and uda.work_date >= v_prev_start_date
    and uda.work_date <= v_prev_end_date
),

-- HR2000 leave ledger integration -- period-filtered leave rows joined
-- directly to leave_ledger_types/employees (not through
-- unified_daily_attendance's per-day collapsed leave_type_codes string), so
-- per-type totals stay accurate even on a multi-leave-type day. Mirrors
-- period_rows' own filter set/effective-range default exactly.
--
-- MATERIALIZED: referenced 4x below (kpi_totals). Same rationale as
-- period_rows/prev_period_rows above -- cheap today since leave_ledger_entries
-- is small, but a multiply-referenced CTE's materialization is a planner
-- heuristic, not a guarantee, and this table will only grow.
employee_leave_rows as materialized (
    select
        le.employee_id as leave_emp_uuid,
        -- Employee/department identity, added 2026-09-25 for the new Top
        -- Leave Days by Employee/Department charts (per HR's own ask) --
        -- previously this CTE only carried what leaveTypeBreakdownData
        -- needed. Same employees/departments join shape used elsewhere in
        -- this RPC (e.g. pending_activity_rows).
        e.full_name as leave_employee_name,
        e.department_id as leave_department_id,
        coalesce(d.name, 'Unassigned') as leave_department_name,
        lt.label as leave_type_label,
        le.day_fraction,
        -- Paid vs. unpaid leave, for payroll prep -- see kpi_totals'
        -- paid_leave_days_count/unpaid_leave_days_count below. CAVEAT:
        -- is_paid is an unconfirmed guess for nearly every leave type today
        -- (leave_ledger_types.needs_hr_confirmation), pending real HR/
        -- payroll sign-off (hyrax-data-platform's leave_ledger_migration.sql)
        -- -- surfaced here at face value per the user's explicit choice, not
        -- flagged in the UI, matching this codebase's existing convention of
        -- disclosing this kind of assumption only in code comments (same
        -- treatment as is_late_arrival's 09:00 threshold).
        --
        -- SECOND CAVEAT (2026-09-25): leave_ledger_types today also mixes
        -- genuine personal leave with what should really be classified as
        -- work-related activity (e.g. official business trips) -- until that
        -- upstream classification is cleaned up, leaveDaysCount and every
        -- chart sourced from this CTE (Leave by Type, and the two new Top
        -- Leave Days charts) will over-count "leave". No dashboard-side fix
        -- is possible until the source classification is corrected.
        lt.is_paid
    from leave_ledger_entries le
    join leave_ledger_types lt on lt.id = le.leave_type_id
    join employees e on e.id = le.employee_id
    left join departments d on d.id = e.department_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
    and (p_employee_id is null or le.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
    and le.leave_date >= v_effective_start_date
    and le.leave_date <= v_effective_end_date
),

-- Same shape, previous-period window -- mirrors prev_period_rows above
-- (always populated now, same reasoning), feeds leaveDaysCount's delta via
-- the same calcDelta convention every other tile on this page already uses.
--
-- MATERIALIZED: referenced 2x below (kpi_totals), same rationale as above.
prev_employee_leave_rows as materialized (
    select le.day_fraction, le.employee_id as leave_emp_uuid, lt.is_paid
    from leave_ledger_entries le
    join leave_ledger_types lt on lt.id = le.leave_type_id
    join employees e on e.id = le.employee_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
    and (p_employee_id is null or le.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
    and le.leave_date >= v_prev_start_date
    and le.leave_date <= v_prev_end_date
),

-- Every Pending-Approval row, unbounded by date -- kpi_totals below reads
-- this twice: once as the TRUE current backlog (no date filter applied to
-- the CTE itself), and once bound to p_start_date/p_end_date for the
-- period-scoped "originated in this range" figure. Which one surfaces in the
-- final kpis object depends on v_has_period (see header comment's 3-question
-- framing). Cheap to keep unbounded regardless: this reads
-- attendance_activities directly, not the comparatively expensive
-- unified_daily_attendance view.
--
-- MATERIALIZED: referenced 2x below (kpi_totals). Same rationale as above.
pending_activity_rows as materialized (
    select aa.*
    from attendance_activities aa
    join employees e on e.id = aa.employee_id
    where aa.approval_status = 'Pending'
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
    and (p_employee_id is null or aa.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
),

-- The TRUE current Missing-Check-Out backlog / period-scoped sibling -- same
-- shape/split as pending_activity_rows above. Condition mirrors
-- unified_daily_attendance's own has_missing_app_checkout definition exactly
-- (clocked_out_at is null, not Rejected).
open_session_rows as materialized (
    select aa.*
    from attendance_activities aa
    join employees e on e.id = aa.employee_id
    where aa.clocked_out_at is null
    and aa.approval_status <> 'Rejected'
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
    and (p_employee_id is null or aa.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
),

-- Trailing 12 months, FIXED-WINDOW family (new chart, 2026-09-25 chart
-- restructuring pass) -- deliberately NOT bounded by p_start_date/
-- p_end_date, always the current month plus the 11 before it, same
-- "always-on trend" convention Sales Reports' own trailing-12-months
-- Bookings-vs-Invoiced chart uses (get_sales_reports_dashboard_rpc.sql) --
-- seasonal attendance patterns are only legible across a fixed multi-month
-- window, not whatever arbitrary range happens to be selected elsewhere on
-- the page. Still respects every non-date filter (department/employee/
-- manager/work location), same as every other family -- only the date
-- dimension is fixed.
--
-- PERFORMANCE (2026-09-25): deliberately NOT materialized and NOT `select
-- uda.*` -- unlike period_rows/prev_period_rows/employee_leave_rows above,
-- this CTE is read by exactly ONE consumer (attendanceRateTrailing12MonthsData
-- below), so there's no multiply-reference cost to save by forcing
-- materialization -- the planner is free to inline this and push the date/
-- filter predicates straight into the view scan. Selecting only the 6
-- columns the aggregate below actually touches (rather than every column
-- unified_daily_attendance exposes) also meaningfully cuts what has to be
-- materialized/copied across a full 12-month, all-employee window, which is
-- the widest scan in this whole RPC.
trailing_12_months_rows as (
    select uda.work_date, uda.day_state, uda.is_expected_working_day, uda.leave_state
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id)
    and uda.work_date >= (date_trunc('month', current_date) - interval '11 months')::date
    and uda.work_date <= (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date
),

kpi_totals as (
    select
        -- "Present" = has any real check-in data -- every hr_flag other
        -- than Absent/Weekend implies at least a first_in exists.
        -- `and not is_on_leave` added (HR2000 leave ledger integration) -- an
        -- on-leave day with no scan falls into neither Absent nor Weekend
        -- once 'On Leave (...)' exists as its own hr_flag value, and must not
        -- silently count as present. `and not is_public_holiday` added for
        -- the same reason -- a company holiday with no scan is now its own
        -- hr_flag value too ('Public Holiday (...)'), not Absent/Weekend, and
        -- must not silently count as present either.
        (select count(*) from period_rows where day_state = 'worked') as present_period_count,
        -- Prior-period sibling, for attendanceRatePct's own subvalue delta
        -- (2026-09-25) -- prev_period_rows is always meaningfully bounded
        -- (see prev_absent_days_count's comment below), same pattern.
        (select count(*) from prev_period_rows where day_state = 'worked') as prev_present_period_count,

        -- Pending Approvals / Missing Check-Outs -- backlog (unbounded by
        -- date, the TRUE current state) vs. period-scoped (originated within
        -- the selected period). Which one surfaces in the final kpis object
        -- depends on v_has_period (see header comment's 3-question framing).
        -- Cheap to compute both unconditionally: these read
        -- attendance_activities directly, not the (comparatively expensive)
        -- unified_daily_attendance view.
        (select count(*) from pending_activity_rows) as pending_backlog_count,
        (select count(*) from pending_activity_rows
         where clocked_in_at::date >= p_start_date and clocked_in_at::date <= p_end_date) as pending_period_count,
        (select count(*) from open_session_rows) as missing_checkout_backlog_count,
        (select count(*) from open_session_rows
         where clocked_in_at::date >= p_start_date and clocked_in_at::date <= p_end_date) as missing_checkout_period_count,

        -- Incomplete Card Scans' own backlog/period figures are NOT computed
        -- here -- see v_incomplete_scans_count, pre-computed above alongside
        -- Needs Reconciliation for the same reason (avoiding an
        -- unconditional extra unified_daily_attendance scan). Referenced
        -- directly as a plain value in the final json_build_object below.

        -- Average check-in/check-out time-of-day, formatted "HH24:MI" here
        -- (same "format server-side" convention hr_flag/hours_worked
        -- already follow elsewhere in this view/RPC) -- averaging a TIME
        -- value means averaging seconds-since-midnight, then reconstituting
        -- via make_interval. Null-safe by construction: avg()/make_interval/
        -- to_char all propagate null through when there's no data.
        -- day_state = 'worked' (2026-09-23), not merely "has evidence on a
        -- non-weekend". These averages describe a NORMAL working day, so
        -- every day with a different expected shape has to be out of them:
        --
        --   * HALF-DAY LEAVE was the motivating case. Someone on approved AM
        --     leave arrives after lunch; averaging that in drags the
        --     company's average check-in later and makes punctuality look
        --     worse than it is, for people who did nothing wrong.
        --   * WORKED PUBLIC HOLIDAYS, previously included (the old predicate
        --     guarded weekends but not holidays), where nobody is keeping to
        --     a normal start time anyway.
        --
        -- This now matches lateArrivalsCount / earlyLeaveCount below, which
        -- read is_late_arrival / is_early_leave -- both of which gained the
        -- same leave guard in the view on the same date. Average check-in and
        -- "how many were late" are two views of one question and must agree
        -- on which days they are asking about.
        (select to_char(make_interval(secs => avg(extract(epoch from first_in::time))), 'HH24:MI')
         from period_rows
         where day_state = 'worked' and first_in is not null) as avg_check_in_time,
        -- Prior-period sibling (2026-09-25), same guard, from
        -- prev_period_rows -- lets the frontend show "X min earlier/later"
        -- instead of a meaningless "%" delta on a time-of-day value.
        (select to_char(make_interval(secs => avg(extract(epoch from first_in::time))), 'HH24:MI')
         from prev_period_rows
         where day_state = 'worked' and first_in is not null) as prev_avg_check_in_time,
        -- The `last_out is not null` guard here does real work as of
        -- 2026-09-23. It was previously unreachable: last_out was
        -- MAX(app_check_out, hw_check_out), and on a single-scan day
        -- hw_check_out is the ARRIVAL scan (MAX = MIN), so a forgotten
        -- badge-out was averaged in as an 08:45 departure and dragged this
        -- figure earlier. The view now returns NULL for those days, so this
        -- line needs no change -- but do not remove the guard.
        (select to_char(make_interval(secs => avg(extract(epoch from last_out::time))), 'HH24:MI')
         from period_rows
         where day_state = 'worked' and last_out is not null) as avg_check_out_time,
        -- Prior-period sibling (2026-09-25) -- same reasoning as
        -- prev_avg_check_in_time above.
        (select to_char(make_interval(secs => avg(extract(epoch from last_out::time))), 'HH24:MI')
         from prev_period_rows
         where day_state = 'worked' and last_out is not null) as prev_avg_check_out_time,

        -- Late arrivals: computed once in unified_daily_attendance
        -- (is_late_arrival -- see that view's own comment for the 09:00
        -- threshold disclosure) rather than re-deriving the threshold
        -- here -- mirrors early_leave_count's own established pattern
        -- below, so the KPI here and the List page's "lateArrival" filter
        -- (attendanceOverviewService.js) can never silently disagree.
        -- is_late_arrival is already false (not null) whenever
        -- first_in_time_of_day is null, so no separate "first_in is not
        -- null" guard is needed.
        (select count(*) from period_rows
         where day_state = 'worked'
         and is_late_arrival) as late_arrivals_count,
        -- Early leave: before 5PM, computed once in unified_daily_attendance
        -- (is_early_leave) rather than re-deriving the threshold here --
        -- see that view's own comment for why (sets up the future
        -- per-work-location threshold as a one-view change, not a rewrite
        -- of every consumer). `not is_public_holiday` on both -- no
        -- expected schedule exists on a company holiday, so arriving
        -- "late" or leaving "early" against a normal-day threshold isn't a
        -- meaningful anomaly that day, same reasoning as not is_on_leave.
        (select count(*) from period_rows
         where day_state = 'worked'
         and is_early_leave) as early_leave_count,

        -- `and not is_on_leave` added (HR2000 leave ledger integration) --
        -- real dilution-bug fix: once 'On Leave (...)' exists as an hr_flag
        -- value it would newly pass this filter with hours_worked = 0,
        -- silently dragging the average down with legitimate zero-hour
        -- leave days.
        --
        -- `and hr_flag <> 'Incomplete Card Scans'` added for the same
        -- reason: a single-scan day computes hw_hours = MIN-MAX = 0 purely
        -- because there's no second scan to diff against, not because 0
        -- hours were actually worked -- the true figure is UNKNOWN, not
        -- zero. Without this exclusion it silently dragged the average down
        -- exactly like the on-leave dilution bug above.
        (select round(avg(hours_worked)::numeric, 2) from period_rows where day_state = 'worked'
             and evidence_quality not in ('single_scan', 'single_scan_and_open_session')) as avg_hours_worked,
        (select round(avg(hours_worked)::numeric, 2) from prev_period_rows where day_state = 'worked'
             and evidence_quality not in ('single_scan', 'single_scan_and_open_session')) as prev_avg_hours_worked,

        -- Overtime (doc-02 KPI): hours worked beyond the normal 8 paid
        -- hours in a day, per Employment Act s.60A, this period. REDEFINED
        -- 2026-09-22 -- this used to mean "time worked after 6PM, NOT hours
        -- above 8/day", which was the exact opposite. No change was needed
        -- here: overtime_hours is still read straight from
        -- unified_daily_attendance (same reasoning as early_leave_count
        -- above -- computed once in the view, not re-derived here), so
        -- swapping the view's formula corrected this KPI automatically.
        -- Expect both the total and the leaderboard to move.
        -- `and not is_on_leave` costs nothing here (a pure-leave zero-scan
        -- day already computes overtime_hours = 0 and fails the >0 filter
        -- regardless) but keeps this block consistent with its neighbors and
        -- guards against a future change silently reintroducing the bug.
        -- `Incomplete Card Scans` excluded for the same unknown-vs-zero
        -- reason as avg_hours_worked above: a single-scan day computes
        -- hw_hours = MAX - MIN = 0 purely because there is no second scan to
        -- diff against, so any overtime_hours it produces isn't trustworthy.
        -- (This comment used to say "last_out for a single-scan day is that
        -- same lone scan's own time" -- true until 2026-09-23, when the view
        -- started returning last_out = NULL on exactly those days. The guard
        -- here is still needed: it is hw_hours, not last_out, that overtime
        -- is derived from.)
        (select round(sum(overtime_hours)::numeric, 2) from period_rows
         where day_state = 'worked'
             and evidence_quality not in ('single_scan', 'single_scan_and_open_session')) as overtime_hours_total,
        (select round(sum(overtime_hours)::numeric, 2) from prev_period_rows
         where day_state = 'worked'
             and evidence_quality not in ('single_scan', 'single_scan_and_open_session')) as prev_overtime_hours_total,
        (select count(distinct employee_uuid) from period_rows
         where day_state = 'worked'
             and evidence_quality not in ('single_scan', 'single_scan_and_open_session') and overtime_hours > 0) as employees_with_overtime_count,

        -- Public holidays integration -- reconciliation metric for
        -- employees who actually attended on a day nobody was expected to
        -- work. is_worked_on_holiday already carries the "real attendance"
        -- check (hr_unified_daily_attendance_view.sql), so no additional
        -- hr_flag/is_on_leave filter is needed here the way overtime_hours
        -- above needs one.
        (select round(sum(holiday_hours_worked)::numeric, 2) from period_rows where is_worked_on_holiday) as holiday_hours_worked_total,
        (select round(sum(holiday_hours_worked)::numeric, 2) from prev_period_rows where is_worked_on_holiday) as prev_holiday_hours_worked_total,
        (select count(distinct employee_uuid) from period_rows where is_worked_on_holiday) as employees_worked_on_holiday_count,

        -- Weekend work -- mirrors the holiday reconciliation metric above
        -- exactly. is_worked_on_weekend already carries the "real
        -- attendance" check, same as is_worked_on_holiday does. Not
        -- mutually exclusive with the holiday figures above -- a Saturday
        -- that's also a public holiday can contribute hours to both totals.
        (select round(sum(weekend_hours_worked)::numeric, 2) from period_rows where is_worked_on_weekend) as weekend_hours_worked_total,
        (select round(sum(weekend_hours_worked)::numeric, 2) from prev_period_rows where is_worked_on_weekend) as prev_weekend_hours_worked_total,
        (select count(distinct employee_uuid) from period_rows where is_worked_on_weekend) as employees_worked_on_weekend_count,

        (select count(*) from period_rows where day_state = 'absent') as absent_days_count,
        -- prev_period_rows is now always meaningfully bounded (see its own
        -- comment -- 2026-09-25, the full previous month by default), so a
        -- plain count(*) is correct: a real zero-absence previous period
        -- reports 0, matching current_period's own shape, no special-casing
        -- needed. (An earlier version of this fix wrapped this in
        -- `case when v_has_period ... else null end`, back when
        -- prev_period_rows was still intentionally empty whenever no range
        -- was picked -- no longer applicable now that it's never empty by
        -- construction.)
        (select count(*) from prev_period_rows where day_state = 'absent') as prev_absent_days_count,

        -- needs_reconciliation/leave_conflict themselves are NOT computed
        -- here -- see v_needs_reconciliation_count/v_leave_conflict_count,
        -- pre-computed above (before this query even runs) via their own
        -- backlog-vs-period plpgsql if/else, precisely to avoid this CTE
        -- forcing an unconditional extra read of unified_daily_attendance on
        -- every call. They're referenced directly as plain values in the
        -- final json_build_object below, not through this CTE.

        -- Denominator for absenteeism/late-arrival rates -- working-day
        -- records only, excluding the Weekend/Rest-Day placeholder rows,
        -- On Leave rows, and (public holidays integration) Public Holiday
        -- rows, the same way Weekend already is -- otherwise attendance/
        -- absenteeism rates get artificially dragged down by days nobody
        -- was expected to attend. A company holiday isn't a working day
        -- regardless of whether one person happened to come in that day.
        (select count(*) from period_rows where is_expected_working_day and leave_state = 'none') as working_day_records_count,
        -- Prior-period sibling (2026-09-25), for attendanceRatePct's own
        -- delta -- same guard, from prev_period_rows.
        (select count(*) from prev_period_rows where is_expected_working_day and leave_state = 'none') as prev_working_day_records_count,

        -- HR2000 leave ledger integration -- leave days this period, its
        -- prior-period sibling (same calcDelta convention as avg_hours_worked/
        -- overtime_hours_total above), and a distinct-employee count for the
        -- KPI tile's sub-metric.
        (select coalesce(sum(day_fraction), 0) from employee_leave_rows) as leave_days_count,
        -- prev_employee_leave_rows is now always meaningfully bounded (same
        -- reasoning as prev_absent_days_count above) -- plain coalesce-to-0
        -- is correct again.
        (select coalesce(sum(day_fraction), 0) from prev_employee_leave_rows) as prev_leave_days_count,
        (select count(distinct leave_emp_uuid) from employee_leave_rows) as employees_on_leave_count,

        -- Paid vs. unpaid split of leave_days_count -- see
        -- employee_leave_rows' own comment for the is_paid confirmation
        -- caveat.
        (select coalesce(sum(day_fraction) filter (where is_paid), 0) from employee_leave_rows) as paid_leave_days_count,
        (select coalesce(sum(day_fraction) filter (where not is_paid), 0) from employee_leave_rows) as unpaid_leave_days_count,
        (select coalesce(sum(day_fraction) filter (where not is_paid), 0) from prev_employee_leave_rows) as prev_unpaid_leave_days_count
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'presentPeriodCount', present_period_count,
            'workingDayRecordsCount', working_day_records_count,
            -- Always the selected period (2026-09-25 -- was "today" whenever
            -- unfiltered). period_rows itself defaults to This Month when no
            -- range is picked, so this already shows the This-Month rate
            -- unfiltered, or the selected-period rate once a range is
            -- chosen -- one formula, no more today/period branch. Pooled
            -- rate across the period (present/roster summed, not an
            -- average-of-daily-rates).
            'attendanceRatePct', case when working_day_records_count > 0
                then round((present_period_count::numeric / working_day_records_count) * 100, 1)
                else 0 end,
            -- Prior-period sibling (2026-09-25), for the tile's own subvalue
            -- delta -- null (not 0) when the prior period had no working-day
            -- records, so calcDelta on the frontend renders "no comparison"
            -- rather than a false 100%/-100% swing.
            'prevAttendanceRatePct', case when prev_working_day_records_count > 0
                then round((prev_present_period_count::numeric / prev_working_day_records_count) * 100, 1)
                else null end,
            -- Backlog (unbounded) fallback, period-originated once a date
            -- range is selected -- see header comment's 3-question framing.
            'pendingApprovalsCount', case when v_has_period then pending_period_count else pending_backlog_count end,
            'missingCheckoutsCount', case when v_has_period then missing_checkout_period_count else missing_checkout_backlog_count end,
            -- Pre-computed above via the same backlog-vs-period if/else as
            -- needsReconciliationCount -- see v_incomplete_scans_count's own
            -- declaration comment.
            'incompleteScansCount', v_incomplete_scans_count,
            'avgCheckInTime', avg_check_in_time,
            'prevAvgCheckInTime', prev_avg_check_in_time,
            'avgCheckOutTime', avg_check_out_time,
            'prevAvgCheckOutTime', prev_avg_check_out_time,
            'lateArrivalsCount', late_arrivals_count,
            'lateArrivalRatePct', case when working_day_records_count > 0
                then round((late_arrivals_count::numeric / working_day_records_count) * 100, 1)
                else 0 end,
            'earlyLeaveCount', early_leave_count,
            'earlyLeaveRatePct', case when working_day_records_count > 0
                then round((early_leave_count::numeric / working_day_records_count) * 100, 1)
                else 0 end,
            'avgHoursWorked', coalesce(avg_hours_worked, 0),
            'prevAvgHoursWorked', prev_avg_hours_worked,
            'overtimeHoursTotal', coalesce(overtime_hours_total, 0),
            'prevOvertimeHoursTotal', prev_overtime_hours_total,
            'employeesWithOvertimeCount', employees_with_overtime_count,
            'holidayHoursWorkedTotal', coalesce(holiday_hours_worked_total, 0),
            'prevHolidayHoursWorkedTotal', prev_holiday_hours_worked_total,
            'employeesWorkedOnHolidayCount', employees_worked_on_holiday_count,
            'weekendHoursWorkedTotal', coalesce(weekend_hours_worked_total, 0),
            'prevWeekendHoursWorkedTotal', prev_weekend_hours_worked_total,
            'employeesWorkedOnWeekendCount', employees_worked_on_weekend_count,
            'absentDaysCount', absent_days_count,
            'prevAbsentDaysCount', prev_absent_days_count,
            -- Pre-computed above (before this query even runs) via their own
            -- backlog-vs-period plpgsql if/else -- see
            -- v_needs_reconciliation_count's own declaration comment.
            'needsReconciliationCount', v_needs_reconciliation_count,
            'leaveConflictCount', v_leave_conflict_count,
            'absentBacklogCount', v_absent_backlog_count,
            'insufficientHalfDayCount', v_insufficient_half_day_count,
            'leaveFractionErrorCount', v_leave_fraction_error_count,
            'leaveDaysCount', leave_days_count,
            'prevLeaveDaysCount', prev_leave_days_count,
            'employeesOnLeaveCount', employees_on_leave_count,
            'paidLeaveDaysCount', paid_leave_days_count,
            'unpaidLeaveDaysCount', unpaid_leave_days_count,
            'prevUnpaidLeaveDaysCount', prev_unpaid_leave_days_count
        )
        from kpi_totals
    ),

    -- Day composition over the period. Weekend rows are excluded -- they would
    -- dominate the chart with a huge, uninteresting bucket.
    --
    -- Keyed on day_state (2026-09-22), replacing the old hrFlagBreakdownData.
    -- Two things that needed hand-bucketing under hr_flag are gone, because
    -- day_state is a closed set of 15 values rather than an open string:
    --
    --   * every dynamic 'On Leave (AL)' / 'On Leave (AL+MC)' variant had to be
    --     collapsed with LIKE, or each distinct leave-type combination
    --     rendered as its own ungrouped grey slice;
    --   * 'Public Holiday (<name>)' needed the same treatment.
    --
    -- The raw snake_case value is emitted, NOT a display label. The frontend
    -- maps it through functions/attendanceDayState.js, which is the single
    -- place those words are decided -- so the chart legend, the filter
    -- dropdown and the StatusBox badges can never disagree about what a state
    -- is called. Emitting a label here would fork that.
    'dayStateBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select day_state as name, count(*) as value,
                   -- Chart drill-through (2026-09-25 restructuring pass):
                   -- `name` above is already the raw filter-safe value (see
                   -- this field's own header comment), but the filter is
                   -- still built explicitly as its own object rather than
                   -- relying on the frontend to reuse `name` after the
                   -- display-labelling pass overwrites it (toLabelledBreakdown
                   -- mutates `name` into a label for rendering).
                   json_build_object('dayState', day_state) as filter
            from period_rows
            where not is_weekend
            group by 1
        ) x
    ),

    -- Data-quality composition -- RECLASSIFIED 2026-09-25 (chart
    -- restructuring pass) from REGULAR (period-bound, via period_rows) to
    -- ACTIONABLE, so it always matches its own Data Quality KPI tile's
    -- family/window exactly (current backlog when unfiltered, period-scoped
    -- once a range is picked). This field existed before but was computed
    -- from period_rows and rendered nowhere on any page -- reviving it with
    -- the wrong family would have shown a number that silently disagreed
    -- with the tile it's meant to pair with. Reuses the SAME already-computed
    -- values the Data Quality KPI itself reads -- no separate scan:
    -- open_session_rows (Missing Check-Outs, same backlog-vs-period bound as
    -- missing_checkout_backlog_count/missing_checkout_period_count below) and
    -- v_incomplete_scans_count (Incomplete Card Scans, pre-computed above).
    -- Exactly 2 categories, matching that tile's own 2 sub-metrics precisely
    -- so this pie's total always equals dataQualityCount.
    'evidenceQualityBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select 'Missing Check-Outs' as name,
                   (select count(*) from open_session_rows
                    where not v_has_period
                       or (clocked_in_at::date >= p_start_date and clocked_in_at::date <= p_end_date)) as value,
                   json_build_object('evidenceQuality', 'open_session') as filter
            union all
            select 'Incomplete Card Scans' as name,
                   v_incomplete_scans_count as value,
                   json_build_object('evidenceQuality', 'single_scan') as filter
        ) x
        where x.value > 0
    ),

    -- Reconciliation Reasons Breakdown -- NEW (2026-09-25 chart restructuring
    -- pass), ACTIONABLE family, pairs with the Needs Reconciliation KPI tile
    -- the same way Top Absenteeism pairs with the Attendance Rate tile.
    -- Reuses the exact same values that tile's own 4 sub-metric rows read
    -- (v_leave_conflict_count/v_absent_backlog_count/
    -- v_insufficient_half_day_count pre-computed above, pending_activity_rows
    -- counted the same backlog-vs-period way pendingApprovalsCount itself
    -- is) so this chart's total always reconciles with that tile -- no
    -- separate scan.
    'reconciliationReasonsBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select 'Pending Approvals' as name,
                   (select count(*) from pending_activity_rows
                    where not v_has_period
                       or (clocked_in_at::date >= p_start_date and clocked_in_at::date <= p_end_date)) as value,
                   json_build_object('approvalState', 'pending') as filter
            union all
            select 'Leave Conflicts' as name, v_leave_conflict_count as value,
                   json_build_object('leaveAttendanceConflict', 'true') as filter
            union all
            select 'Insufficient Half-Day Hours' as name, v_insufficient_half_day_count as value,
                   json_build_object('insufficientHalfDayHours', 'unresolved') as filter
            union all
            select 'Absent' as name, v_absent_backlog_count as value,
                   json_build_object('dayState', 'absent') as filter
        ) x
        where x.value > 0
    ),

    -- Top 10 employees by outstanding Needs Reconciliation records --
    -- pre-computed above (v_top_needs_reconciliation_data) via the same
    -- backlog-vs-period if/else as needsReconciliationCount itself.
    'topNeedsReconciliationData', coalesce(v_top_needs_reconciliation_data, '[]'::json),

    -- Top 10 employees by outstanding Data Quality records -- pre-computed
    -- above (v_top_data_quality_data), same reasoning.
    'topDataQualityData', coalesce(v_top_data_quality_data, '[]'::json),

    -- Date x present-count/roster-count, period-bound, bucketed by
    -- v_trend_bucket (day, or week once the range exceeds 60 days).
    -- Frontend derives the daily/weekly attendance-rate line from these two
    -- raw counts.
    -- Which bucket the two trend series below were actually grouped by:
    -- 'day', or 'week' once the selected range exceeds 60 days (see
    -- v_trend_bucket). Exposed 2026-09-23 because the frontend hardcoded
    -- "By Day" in both chart subtitles, so a year-to-date view silently
    -- presented weekly points as daily ones.
    'trendBucket', v_trend_bucket,

    'dailyAttendanceTrendData', (
        select coalesce(json_agg(x order by x.bucket_start), '[]'::json)
        from (
            select
                to_char(date_trunc(v_trend_bucket, work_date), 'YYYY-MM-DD') as period,
                date_trunc(v_trend_bucket, work_date) as bucket_start,
                -- `and not is_on_leave`/`and not is_public_holiday` on both
                -- (HR2000 leave ledger + public holidays integration) --
                -- must stay reconciled with the headline attendanceRatePct
                -- definition (same present/roster ratio).
                count(*) filter (where day_state = 'worked') as present_count,
                count(*) filter (where leave_state = 'none') as roster_count,
                -- Chart drill-through (2026-09-25): the exact date range
                -- this bucket spans, sized to whichever bucket is actually
                -- active (a single day, or a full week once v_trend_bucket
                -- switches) -- computed here rather than in the frontend so
                -- a point's filter can never disagree with what the point
                -- was actually aggregated from.
                json_build_object(
                    'startDate', to_char(date_trunc(v_trend_bucket, work_date), 'YYYY-MM-DD'),
                    'endDate', to_char(
                        date_trunc(v_trend_bucket, work_date)
                            + case when v_trend_bucket = 'week' then interval '6 days' else interval '0 days' end,
                        'YYYY-MM-DD'
                    )
                ) as filter
            -- WORKING DAYS ONLY (2026-09-25 fix): previously ungrouped
            -- period_rows included weekend/public-holiday dates as their own
            -- bucket too -- each one had present_count=0/roster_count=0 (no
            -- one is expected to work), rendering as a false 0% dip every
            -- weekend on a 'day' bucket, or diluting a whole week's rate
            -- down on a 'week' bucket. is_expected_working_day already
            -- excludes both (see working_day_records_count's own comment
            -- below for the same guard on the headline KPI).
            from period_rows
            where is_expected_working_day
            group by date_trunc(v_trend_bucket, work_date)
        ) x
    ),

    -- Date x average hours worked, same bucketing as above (working-day
    -- records only).
    'hoursWorkedTrendData', (
        select coalesce(json_agg(x order by x.bucket_start), '[]'::json)
        from (
            select
                to_char(date_trunc(v_trend_bucket, work_date), 'YYYY-MM-DD') as period,
                date_trunc(v_trend_bucket, work_date) as bucket_start,
                -- Incomplete Card Scans excluded -- same unknown-vs-zero
                -- reasoning as kpi_totals.avg_hours_worked above.
                -- Same predicate as the headline avg_hours_worked KPI above.
                -- It previously omitted `and not is_on_leave`, so the trend
                -- line averaged over leave days while the tile beside it did
                -- not -- two numbers for one metric, differing silently.
                round(avg(hours_worked) filter (
                    where day_state = 'worked'
                      and evidence_quality not in ('single_scan', 'single_scan_and_open_session')
                )::numeric, 2) as avg_hours,
                -- Chart drill-through (2026-09-25) -- same bucket-sized
                -- date-range filter as dailyAttendanceTrendData above.
                json_build_object(
                    'startDate', to_char(date_trunc(v_trend_bucket, work_date), 'YYYY-MM-DD'),
                    'endDate', to_char(
                        date_trunc(v_trend_bucket, work_date)
                            + case when v_trend_bucket = 'week' then interval '6 days' else interval '0 days' end,
                        'YYYY-MM-DD'
                    )
                ) as filter
            -- WORKING DAYS ONLY (2026-09-25 fix) -- same reasoning as
            -- dailyAttendanceTrendData above: without this, a weekend/
            -- holiday bucket has no `day_state = 'worked'` rows to average,
            -- so avg_hours came back null (rendered as 0 by the frontend) --
            -- a false 0-hour dip every weekend.
            from period_rows
            where is_expected_working_day
            group by date_trunc(v_trend_bucket, work_date)
        ) x
    ),

    -- Department x attendance rate, period-bound -- same present/roster
    -- ratio as the headline KPI, cut by department instead of company-wide.
    'departmentAttendanceData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select
                coalesce(department_name, 'Unassigned') as name,
                -- `and not is_on_leave`/`and not is_public_holiday` on both
                -- (HR2000 leave ledger + public holidays integration) --
                -- same present/roster ratio as the headline KPI, cut by
                -- department, must stay reconciled with it.
                round(
                    (count(*) filter (where day_state = 'worked')::numeric
                    / nullif(count(*) filter (where is_expected_working_day and leave_state = 'none'), 0)) * 100
                , 1) as value,
                -- Chart drill-through (2026-09-25): null for the
                -- "Unassigned" bucket (department_id itself is null there)
                -- -- left unclickable rather than risk an ambiguous
                -- "department is null" filter the list page doesn't support.
                case when department_id is not null
                    then json_build_object('department', department_id)
                    else null end as filter
            from period_rows
            group by coalesce(department_name, 'Unassigned'), department_id
        ) x
    ),

    -- Work Channel Mix (doc-02's "WFH vs office split" -- here Hardware-scan
    -- vs App/remote, since that's Hyrax's actual channel distinction):
    -- classifies every working-day record by which check-in source(s) it has.
    'workChannelMixData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select
                channel as name,
                count(*) as value,
                -- Chart drill-through (2026-09-25): mirrors the SAME
                -- hw/app-presence bucketing below rather than reading
                -- evidence_source directly, so this filter can never
                -- disagree with the bucket a row was actually counted into.
                -- 'Unclassified' has no single matching evidenceSource value
                -- and is left unclickable.
                case channel
                    when 'Both' then json_build_object('evidenceSource', 'both')
                    when 'Office' then json_build_object('evidenceSource', 'hardware')
                    when 'Remote' then json_build_object('evidenceSource', 'app')
                    else null
                end as filter
            from (
                select
                    case
                        when hw_check_in is not null and app_check_in is not null then 'Both'
                        when hw_check_in is not null then 'Office'
                        when app_check_in is not null then 'Remote'
                        else 'Unclassified'
                    end as channel
                from period_rows
                -- `and not is_on_leave`/`and not is_public_holiday` --
                -- otherwise a pure on-leave or holiday zero-scan day gets
                -- miscategorized as 'Unclassified' channel instead of being
                -- excluded like Absent.
                where day_state = 'worked'
            ) c
            group by channel
        ) x
    ),

    -- Top 10 employees by absent-day count this period -- the actionable
    -- "who to follow up with" list.
    'topAbsenteeismData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select full_name as name, count(*) as value,
                   json_build_object('employee', employee_uuid) as filter
            from period_rows
            where day_state = 'absent'
            group by full_name, employee_uuid
            order by count(*) desc
            limit 10
        ) x
    ),

    -- Top 10 employees by total overtime hours this period -- the
    -- burnout-risk/comp companion to the headline Overtime Hours tile.
    'topOvertimeData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select full_name as name, round(sum(overtime_hours)::numeric, 2) as value,
                   json_build_object('employee', employee_uuid) as filter
            from period_rows
            where day_state = 'worked'
             and evidence_quality not in ('single_scan', 'single_scan_and_open_session')
            group by full_name, employee_uuid
            having sum(overtime_hours) > 0
            order by value desc
            limit 10
        ) x
    ),

    -- HR2000 leave ledger integration -- leave days by type, this period.
    -- Sourced from employee_leave_rows directly (joined straight to
    -- leave_ledger_types), not unified_daily_attendance's per-day collapsed
    -- leave_type_codes string, so a multi-type day's totals split correctly.
    'leaveTypeBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select leave_type_label as name, sum(day_fraction) as value
            from employee_leave_rows
            group by leave_type_label
        ) x
    ),

    -- Top Leave Days by Employee -- NEW (2026-09-25 chart restructuring
    -- pass, per HR's own explicit ask), REGULAR family, same window as the
    -- Leave Days KPI tile. Inherits employee_leave_rows' own two disclosed
    -- caveats (is_paid confirmation, and leave types that should really be
    -- classified as work-related activity -- see that CTE's own comment).
    'topLeaveDaysByEmployeeData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select leave_employee_name as name, sum(day_fraction) as value,
                   json_build_object('employee', leave_emp_uuid) as filter
            from employee_leave_rows
            group by leave_employee_name, leave_emp_uuid
            order by sum(day_fraction) desc
            limit 10
        ) x
    ),

    -- Top Leave Days by Department -- same caveats as above. Not top-10-capped
    -- -- department count is small enough that "top" would just mean "all,
    -- sorted".
    'leaveDaysByDepartmentData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select leave_department_name as name, sum(day_fraction) as value,
                   case when leave_department_id is not null
                       then json_build_object('department', leave_department_id)
                       else null end as filter
            from employee_leave_rows
            group by leave_department_name, leave_department_id
        ) x
    ),

    -- Trailing 12 months attendance rate -- FIXED-WINDOW family (new chart,
    -- 2026-09-25 restructuring pass), sourced from trailing_12_months_rows
    -- above (always the current month + the 11 before it, ignores the
    -- page's date filter entirely). Same present/roster ratio as the
    -- headline Attendance Rate KPI, bucketed by month. Filter payload is a
    -- startDate/endDate pair spanning that month, for the chart-element
    -- drill-through convention.
    'attendanceRateTrailing12MonthsData', (
        select coalesce(json_agg(x order by x.bucket_start), '[]'::json)
        from (
            select
                to_char(date_trunc('month', work_date), 'Mon YYYY') as period,
                date_trunc('month', work_date) as bucket_start,
                round(
                    (count(*) filter (where day_state = 'worked')::numeric
                    / nullif(count(*) filter (where is_expected_working_day and leave_state = 'none'), 0)) * 100
                , 1) as value,
                json_build_object(
                    'startDate', to_char(date_trunc('month', work_date), 'YYYY-MM-DD'),
                    'endDate', to_char((date_trunc('month', work_date) + interval '1 month' - interval '1 day')::date, 'YYYY-MM-DD')
                ) as filter
            from trailing_12_months_rows
            group by date_trunc('month', work_date)
        ) x
    )

)
into result;

return result;

end;
$$;
