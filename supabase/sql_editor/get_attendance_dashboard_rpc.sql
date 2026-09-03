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
-- Point-in-time vs period-bound (DASHBOARD-CONVENTIONS.md): presentTodayCount/
-- activeHeadcountToday/pending_backlog_count/missing_checkout_backlog_count/
-- incomplete_scans_today_count/oldest_pending_backlog_hours are always
-- computed (today or true unbounded backlog, matching Finance's AR aging
-- convention), but which of those vs. their period-scoped siblings actually
-- surfaces in the final `attendanceRatePct`/`pendingApprovalsCount`/
-- `missingCheckoutsCount`/`incompleteScansCount`/`oldestPendingApprovalHours`
-- keys depends on v_has_period -- see "Pass 4" below. activeHeadcountToday
-- is read from employees/employment_status directly, NOT from
-- unified_daily_attendance -- that view only produces a row for a given
-- date once at least one scan/activity happens somewhere that day (its own
-- active_company_dates spine), so reading headcount from it would show 0
-- before the first scan of the morning ("nobody's employed" instead of
-- "nobody's scanned yet").
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
-- Today-vs-period toggle + backlog fix ("Pass 4"): Attendance Rate/Pending
-- Approvals/Attendance Anomalies previously always computed from literal
-- work_date = current_date, regardless of the period filter selected
-- elsewhere on the page. Per the user's decision: fall back to today when
-- no period is selected, switch to reflect the selected period once one is
-- chosen (v_has_period drives this, same test already used for
-- prev_period_rows/v_trend_bucket). While designing that, a real bug
-- surfaced: hr_flag values like 'Pending App Approval'/'Missing App
-- Check-Out' are anchored to the day the *original activity* was clocked
-- in, not to today -- an activity clocked in 3 days ago that's still
-- pending/still has no checkout never appears in today_rows (work_date =
-- current_date), so the old "Pending Approvals" count silently excluded
-- any backlog older than today. Fixed by sourcing the no-period fallback
-- from the true, unbounded-by-date backlog (pending_activity_rows/
-- open_session_rows) instead of today_rows -- this is a correctness fix
-- independent of the period-toggle feature, not just a side effect of it.
-- Incomplete Card Scans is NOT given this backlog treatment -- it's a
-- per-day hardware fact (one scan that day, no in/out pair), not a
-- lingering state that later resolves, so "today" is the right no-period
-- default the same way it always was.
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
    p_manager_id    uuid default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_interval integer;
    v_prev_start_date date;
    v_prev_end_date date;
    v_trend_bucket text;
    -- Drives the "today fallback, period once selected" behavior for the
    -- Attendance Rate / Pending Approvals / Attendance Anomalies tiles
    -- ("Pass 4" -- see header comment). Same test already used for
    -- prev_period_rows/v_trend_bucket, reused here as the single switch.
    v_has_period boolean;
    -- ASSUMPTION, not a real company policy: no shift/schedule table exists
    -- anywhere in this schema (no expected start time per employee/
    -- department), so "late" has no real threshold to compute against.
    -- Fixed at 09:00 company-wide until real shift data exists -- revisit
    -- then. Surfaced in the Overview page's own tile tooltip so this stays
    -- a disclosed assumption, not a silent policy decision.
    v_late_threshold_time constant time := '09:00:00';
    -- Same assumption, symmetric end-of-day counterpart to
    -- v_late_threshold_time above (a plain 9-to-6 company-wide shift) --
    -- also disclosed in its own tile's tooltip, not a real policy.
    v_early_leave_threshold_time constant time := '18:00:00';
begin

-- 1. Calculate the Previous Period for Deltas (mirrors get_hr_employees_dashboard)
if p_start_date is not null and p_end_date is not null then
    v_interval := p_end_date - p_start_date;
    v_prev_end_date := p_start_date - 1;
    v_prev_start_date := v_prev_end_date - v_interval;
end if;

v_has_period := (p_start_date is not null and p_end_date is not null);

-- 2. Trend-chart bucket size: day by default, week once the selected range
-- exceeds 60 days (e.g. "This Year") -- keeps the two trend charts readable
-- instead of rendering an unreadable ~250-point daily line. Both trend
-- charts below apply the same v_trend_bucket, so they never disagree.
v_trend_bucket := case
    when p_start_date is not null and p_end_date is not null and (p_end_date - p_start_date) > 60
    then 'week'
    else 'day'
end;

with active_employees as (
    select e.id, e.department_id
    from employees e
    join employment_status es on es.id = e.employment_status_id and es.category = 'active'
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or e.id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
),

active_headcount_today as (
    select count(*) as headcount from active_employees
),

-- Period-bound rows, scoped by the same department/employee filters.
-- Defaults to "This Month" when the caller sends no range at all (an
-- all-time trend chart would otherwise span years of noise) -- note
-- SearchFilterBar's own date-range presets always send an explicit range,
-- so this default only matters on a completely unfiltered first load.
period_rows as (
    select uda.*
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id)
    and uda.work_date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
    and uda.work_date <= coalesce(p_end_date, current_date)
),

prev_period_rows as (
    select uda.*
    from unified_daily_attendance uda
    where p_start_date is not null and p_end_date is not null
    and (p_department_id is null or uda.department_id = p_department_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id)
    and uda.work_date >= v_prev_start_date
    and uda.work_date <= v_prev_end_date
),

-- HR2000 leave ledger integration -- period-filtered leave rows joined
-- directly to leave_ledger_types/employees (not through
-- unified_daily_attendance's per-day collapsed leave_type_codes string), so
-- per-type totals stay accurate even on a multi-leave-type day. Mirrors
-- period_rows' own filter set/default-to-month-to-date behavior exactly.
employee_leave_rows as (
    select
        le.employee_id as leave_emp_uuid,
        e.full_name,
        coalesce(d.name, 'Unassigned') as department_name,
        lt.code as leave_type_code,
        lt.label as leave_type_label,
        le.day_fraction
    from leave_ledger_entries le
    join leave_ledger_types lt on lt.id = le.leave_type_id
    join employees e on e.id = le.employee_id
    left join departments d on d.id = e.department_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or le.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
    and le.leave_date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
    and le.leave_date <= coalesce(p_end_date, current_date)
),

-- Same shape, previous-period window -- mirrors prev_period_rows, feeds
-- leaveDaysCount's delta via the same calcDelta convention every other tile
-- on this page already uses.
prev_employee_leave_rows as (
    select le.day_fraction, le.employee_id as leave_emp_uuid
    from leave_ledger_entries le
    join employees e on e.id = le.employee_id
    where p_start_date is not null and p_end_date is not null
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or le.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
    and le.leave_date >= v_prev_start_date
    and le.leave_date <= v_prev_end_date
),

today_rows as (
    select uda.*
    from unified_daily_attendance uda
    where uda.work_date = current_date
    and (p_department_id is null or uda.department_id = p_department_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and (p_manager_id is null or uda.manager_id = p_manager_id)
),

-- Approval turnaround needs attendance_activities directly --
-- unified_daily_attendance doesn't preserve per-activity approved_at.
approved_activity_rows as (
    select aa.*
    from attendance_activities aa
    join employees e on e.id = aa.employee_id
    where aa.approval_status in ('Approved', 'Rejected')
    and aa.approved_at is not null
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or aa.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
    and aa.clocked_in_at::date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
    and aa.clocked_in_at::date <= coalesce(p_end_date, current_date)
),

-- The TRUE current Pending-Approval backlog -- unbounded by date (see
-- header comment's "Pass 4" note). kpi_totals below further splits this
-- into a backlog-scoped and a period-scoped scalar; which one actually
-- surfaces in the final kpis object depends on v_has_period.
pending_activity_rows as (
    select aa.*
    from attendance_activities aa
    join employees e on e.id = aa.employee_id
    where aa.approval_status = 'Pending'
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or aa.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
),

-- The TRUE current Missing-Check-Out backlog -- same shape/filters as
-- pending_activity_rows, unbounded by date. Condition mirrors
-- unified_daily_attendance's own has_missing_app_checkout definition
-- exactly (clocked_out_at is null, not Rejected).
open_session_rows as (
    select aa.*
    from attendance_activities aa
    join employees e on e.id = aa.employee_id
    where aa.clocked_out_at is null
    and aa.approval_status <> 'Rejected'
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or aa.employee_id = p_employee_id)
    and (p_manager_id is null or e.manager_id = p_manager_id)
),

-- Per-employee, period-scoped reconciliation summary -- one row per employee
-- with any working-day record this period, backing the Overview page's new
-- "Leave Reconciliation" per-employee table. Reuses period_rows' already-
-- proven hr_flag/hours_worked filter conditions, grouped by employee instead
-- of summed company-wide.
employee_reconciliation as (
    select
        pr.employee_uuid,
        pr.full_name,
        coalesce(pr.department_name, 'Unassigned') as department_name,
        count(*) filter (where pr.hr_flag not in ('Absent', 'Weekend / Rest Day') and not pr.is_on_leave) as present_days,
        count(*) filter (where pr.hr_flag = 'Absent') as absent_days,
        round(sum(greatest(pr.hours_worked - 8, 0)) filter (where pr.hr_flag not in ('Weekend / Rest Day', 'Absent') and not pr.is_on_leave)::numeric, 2) as overtime_hours,
        count(*) filter (where pr.hr_flag not in ('Weekend / Rest Day', 'Absent') and pr.first_in is not null and pr.first_in::time > v_late_threshold_time) as late_arrivals,
        count(*) filter (where pr.hr_flag not in ('Weekend / Rest Day', 'Absent') and pr.last_out is not null and pr.last_out::time < v_early_leave_threshold_time) as early_leaves,
        count(*) filter (where pr.hr_flag in ('Missing App Check-Out', 'Incomplete Card Scans')) as anomalies
    from period_rows pr
    group by pr.employee_uuid, pr.full_name, pr.department_name
),

-- Per-employee leave summary, folded from employee_leave_rows -- total days
-- plus a compact "AL: 2, MC: 1"-style breakdown string for the table cell.
employee_leave_summary as (
    select
        leave_emp_uuid,
        sum(type_total) as leave_days_total,
        string_agg(leave_type_code || ': ' || trim(to_char(type_total, 'FM990.0')), ', ' order by leave_type_code) as leave_breakdown
    from (
        select leave_emp_uuid, leave_type_code, sum(day_fraction) as type_total
        from employee_leave_rows
        group by leave_emp_uuid, leave_type_code
    ) per_type
    group by leave_emp_uuid
),

kpi_totals as (
    select
        (select headcount from active_headcount_today) as active_headcount_today,

        -- "Present" = has any real check-in data -- every hr_flag other
        -- than Absent/Weekend implies at least a first_in exists. Today and
        -- period variants both computed; the kpis object below picks
        -- whichever v_has_period calls for. `and not is_on_leave` added
        -- (HR2000 leave ledger integration) -- an on-leave day with no scan
        -- falls into neither Absent nor Weekend once 'On Leave (...)' exists
        -- as its own hr_flag value, and must not silently count as present.
        (select count(*) from today_rows where hr_flag not in ('Absent', 'Weekend / Rest Day') and not is_on_leave) as present_today_count,
        (select count(*) from period_rows where hr_flag not in ('Absent', 'Weekend / Rest Day') and not is_on_leave) as present_period_count,

        -- Pending Approvals -- backlog (unbounded by date, the TRUE current
        -- state) vs period-scoped (originated within the selected period).
        -- See header comment's "Pass 4" note for why the backlog variant
        -- replaced a today_rows-based count that silently missed anything
        -- older than today.
        (select count(*) from pending_activity_rows) as pending_backlog_count,
        (select count(*) from pending_activity_rows
         where clocked_in_at::date >= p_start_date and clocked_in_at::date <= p_end_date) as pending_period_count,

        -- Missing Check-Outs -- same backlog/period split as Pending
        -- Approvals, same reasoning (an open app session from days ago
        -- shouldn't disappear from view just because it isn't "today").
        (select count(*) from open_session_rows) as missing_checkout_backlog_count,
        (select count(*) from open_session_rows
         where clocked_in_at::date >= p_start_date and clocked_in_at::date <= p_end_date) as missing_checkout_period_count,

        -- Incomplete Card Scans -- NOT given the backlog treatment: this is
        -- a per-day hardware fact (one scan that day, no in/out pair), not
        -- a lingering state that later resolves. Today vs period-total only.
        (select count(*) from today_rows where hr_flag = 'Incomplete Card Scans') as incomplete_scans_today_count,
        (select count(*) from period_rows where hr_flag = 'Incomplete Card Scans') as incomplete_scans_period_count,

        -- Approval turnaround (Pending Approvals tile's "so what/now what").
        -- Already period-shaped (silently defaults to "This Month" via
        -- coalesce, same as Average Hours Worked/Overtime) -- a rate/average,
        -- not a backlog count, so it isn't part of the v_has_period toggle.
        (select round(avg(extract(epoch from (approved_at - clocked_in_at)) / 3600)::numeric, 1)
         from approved_activity_rows) as avg_approval_turnaround_hours,
        (select round(max(extract(epoch from (now() - clocked_in_at)) / 3600)::numeric, 1)
         from pending_activity_rows) as oldest_pending_backlog_hours,
        (select round(max(extract(epoch from (now() - clocked_in_at)) / 3600)::numeric, 1)
         from pending_activity_rows
         where clocked_in_at::date >= p_start_date and clocked_in_at::date <= p_end_date) as oldest_pending_period_hours,

        -- Average check-in/check-out time-of-day, formatted "HH24:MI" here
        -- (same "format server-side" convention hr_flag/hours_worked
        -- already follow elsewhere in this view/RPC) -- averaging a TIME
        -- value means averaging seconds-since-midnight, then reconstituting
        -- via make_interval. Null-safe by construction: avg()/make_interval/
        -- to_char all propagate null through when there's no data.
        (select to_char(make_interval(secs => avg(extract(epoch from first_in::time))), 'HH24:MI')
         from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent') and first_in is not null) as avg_check_in_time,
        (select to_char(make_interval(secs => avg(extract(epoch from last_out::time))), 'HH24:MI')
         from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent') and last_out is not null) as avg_check_out_time,

        -- Late arrivals / early leave -- see v_late_threshold_time and
        -- v_early_leave_threshold_time's own comments above.
        (select count(*) from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent')
         and first_in is not null
         and first_in::time > v_late_threshold_time) as late_arrivals_count,
        (select count(*) from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent')
         and last_out is not null
         and last_out::time < v_early_leave_threshold_time) as early_leave_count,

        -- `and not is_on_leave` added (HR2000 leave ledger integration) --
        -- real dilution-bug fix: once 'On Leave (...)' exists as an hr_flag
        -- value it would newly pass this filter with hours_worked = 0,
        -- silently dragging the average down with legitimate zero-hour
        -- leave days.
        (select round(avg(hours_worked)::numeric, 2) from period_rows where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave) as avg_hours_worked,
        (select round(avg(hours_worked)::numeric, 2) from prev_period_rows where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave) as prev_avg_hours_worked,

        -- Overtime (doc-02 KPI): total hours above 8/day, this period.
        -- `and not is_on_leave` costs nothing here (a pure-leave zero-scan
        -- day already contributes 0 to the sum and fails the >8 filter
        -- regardless) but keeps this block consistent with its neighbors and
        -- guards against a future change silently reintroducing the bug.
        (select round(sum(greatest(hours_worked - 8, 0))::numeric, 2) from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave) as overtime_hours_total,
        (select round(sum(greatest(hours_worked - 8, 0))::numeric, 2) from prev_period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave) as prev_overtime_hours_total,
        (select count(distinct employee_uuid) from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave and hours_worked > 8) as employees_with_overtime_count,

        (select count(*) from period_rows where hr_flag = 'Absent') as absent_days_count,
        (select count(*) from prev_period_rows where hr_flag = 'Absent') as prev_absent_days_count,

        -- Denominator for absenteeism/late-arrival rates -- working-day
        -- records only, excluding the Weekend/Rest-Day placeholder rows and
        -- (HR2000 leave ledger integration) On Leave rows, the same way
        -- Weekend already is -- otherwise attendance/absenteeism rates get
        -- artificially dragged down by days nobody was expected to attend.
        (select count(*) from period_rows where hr_flag <> 'Weekend / Rest Day' and not is_on_leave) as working_day_records_count,

        -- HR2000 leave ledger integration -- leave days this period, its
        -- prior-period sibling (same calcDelta convention as avg_hours_worked/
        -- overtime_hours_total above), and a distinct-employee count for the
        -- KPI tile's sub-metric.
        (select coalesce(sum(day_fraction), 0) from employee_leave_rows) as leave_days_count,
        (select coalesce(sum(day_fraction), 0) from prev_employee_leave_rows) as prev_leave_days_count,
        (select count(distinct leave_emp_uuid) from employee_leave_rows) as employees_on_leave_count
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'activeHeadcountToday', active_headcount_today,
            'presentTodayCount', present_today_count,
            'presentPeriodCount', present_period_count,
            'workingDayRecordsCount', working_day_records_count,
            -- Today fallback, period once selected (v_has_period) -- see
            -- header comment's "Pass 4" note. Pooled rate across the period
            -- (present/roster summed, not an average-of-daily-rates).
            'attendanceRatePct', case
                when v_has_period then case when working_day_records_count > 0
                    then round((present_period_count::numeric / working_day_records_count) * 100, 1)
                    else 0 end
                else case when active_headcount_today > 0
                    then round((present_today_count::numeric / active_headcount_today) * 100, 1)
                    else 0 end
                end,
            -- Backlog (unbounded) fallback, period-originated once selected.
            'pendingApprovalsCount', case when v_has_period then pending_period_count else pending_backlog_count end,
            'missingCheckoutsCount', case when v_has_period then missing_checkout_period_count else missing_checkout_backlog_count end,
            'incompleteScansCount', case when v_has_period then incomplete_scans_period_count else incomplete_scans_today_count end,
            'avgApprovalTurnaroundHours', avg_approval_turnaround_hours,
            'oldestPendingApprovalHours', case when v_has_period then oldest_pending_period_hours else oldest_pending_backlog_hours end,
            'avgCheckInTime', avg_check_in_time,
            'avgCheckOutTime', avg_check_out_time,
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
            'absentDaysCount', absent_days_count,
            'prevAbsentDaysCount', prev_absent_days_count,
            'absenteeismRatePct', case when working_day_records_count > 0
                then round((absent_days_count::numeric / working_day_records_count) * 100, 1)
                else 0 end,
            'leaveDaysCount', leave_days_count,
            'prevLeaveDaysCount', prev_leave_days_count,
            'employeesOnLeaveCount', employees_on_leave_count
        )
        from kpi_totals
    ),

    -- Anomaly/status composition over the period. Weekend/Rest-Day rows are
    -- excluded -- they'd dominate this chart with a huge, uninteresting
    -- bucket on an anomaly-focused view.
    -- HR2000 leave ledger integration -- every dynamic "On Leave (AL)"/
    -- "On Leave (AL+MC)" value is bucketed into one flat "On Leave" category
    -- before grouping, otherwise each distinct leave-type combination would
    -- render as its own ungrouped, uncolored (grey) slice -- chartColors.js's
    -- ATTENDANCE_FLAG_COLORS only maps the single "On Leave" bucket, not
    -- every possible type-code combination.
    'hrFlagBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select
                case when hr_flag like 'On Leave%' then 'On Leave' else hr_flag end as name,
                count(*) as value
            from period_rows
            where hr_flag <> 'Weekend / Rest Day'
            group by 1
        ) x
    ),

    -- Date x present-count/roster-count, period-bound, bucketed by
    -- v_trend_bucket (day, or week once the range exceeds 60 days).
    -- Frontend derives the daily/weekly attendance-rate line from these two
    -- raw counts.
    'dailyAttendanceTrendData', (
        select coalesce(json_agg(x order by x.bucket_start), '[]'::json)
        from (
            select
                to_char(date_trunc(v_trend_bucket, work_date), 'YYYY-MM-DD') as period,
                date_trunc(v_trend_bucket, work_date) as bucket_start,
                -- `and not is_on_leave` on both (HR2000 leave ledger
                -- integration) -- must stay reconciled with the headline
                -- attendanceRatePct definition (same present/roster ratio).
                count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day') and not is_on_leave) as present_count,
                count(*) filter (where hr_flag <> 'Weekend / Rest Day' and not is_on_leave) as roster_count
            from period_rows
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
                round(avg(hours_worked) filter (where hr_flag not in ('Weekend / Rest Day', 'Absent'))::numeric, 2) as avg_hours
            from period_rows
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
                -- `and not is_on_leave` on both (HR2000 leave ledger
                -- integration) -- same present/roster ratio as the headline
                -- KPI, cut by department, must stay reconciled with it.
                round(
                    (count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day') and not is_on_leave)::numeric
                    / nullif(count(*) filter (where hr_flag <> 'Weekend / Rest Day' and not is_on_leave), 0)) * 100
                , 1) as value
            from period_rows
            group by coalesce(department_name, 'Unassigned')
        ) x
    ),

    -- Work Channel Mix (doc-02's "WFH vs office split" -- here Hardware-scan
    -- vs App/remote, since that's Hyrax's actual channel distinction):
    -- classifies every working-day record by which check-in source(s) it has.
    'workChannelMixData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select
                case
                    when hw_check_in is not null and app_check_in is not null then 'Both'
                    when hw_check_in is not null then 'Office'
                    when app_check_in is not null then 'Remote'
                    else 'Unclassified'
                end as name,
                count(*) as value
            from period_rows
            -- `and not is_on_leave` (HR2000 leave ledger integration) --
            -- otherwise a pure on-leave zero-scan day gets miscategorized as
            -- 'Unclassified' channel instead of being excluded like Absent.
            where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave
            group by 1
        ) x
    ),

    -- Top 10 employees by absent-day count this period -- the actionable
    -- "who to follow up with" list.
    'topAbsenteeismData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select full_name as name, count(*) as value
            from period_rows
            where hr_flag = 'Absent'
            group by full_name
            order by count(*) desc
            limit 10
        ) x
    ),

    -- Top 10 employees by total overtime hours this period -- the
    -- burnout-risk/comp companion to the headline Overtime Hours tile.
    'topOvertimeData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select full_name as name, round(sum(greatest(hours_worked - 8, 0))::numeric, 2) as value
            from period_rows
            where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave
            group by full_name
            having sum(greatest(hours_worked - 8, 0)) > 0
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

    -- Per-employee payroll-cycle reconciliation: present/absent/leave/
    -- overtime/anomalies, one row per employee, this period -- backs the
    -- Overview page's new "Leave Reconciliation" per-employee table.
    'employeeReconciliationData', (
        select coalesce(json_agg(x order by x.full_name), '[]'::json)
        from (
            select
                er.employee_uuid,
                er.full_name,
                er.department_name,
                er.present_days,
                er.absent_days,
                coalesce(els.leave_days_total, 0) as leave_days_total,
                els.leave_breakdown,
                coalesce(er.overtime_hours, 0) as overtime_hours,
                er.late_arrivals,
                er.early_leaves,
                er.anomalies
            from employee_reconciliation er
            left join employee_leave_summary els on els.leave_emp_uuid = er.employee_uuid
        ) x
    )

)
into result;

return result;

end;
$$;
