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
-- Point-in-time vs period-bound (DASHBOARD-CONVENTIONS.md): the "Today"
-- KPIs (presentTodayCount, pendingApprovalsCount, missingCheckoutsCount,
-- incompleteScansCount, oldestPendingApprovalHours) always read
-- work_date = current_date (or, for pending approvals, "right now") and
-- ignore p_start_date/p_end_date, same as Finance's AR aging.
-- activeHeadcountToday is read from employees/employment_status directly,
-- NOT from unified_daily_attendance -- that view only produces a row for a
-- given date once at least one scan/activity happens somewhere that day
-- (its own active_company_dates spine), so reading headcount from it would
-- show 0 before the first scan of the morning ("nobody's employed" instead
-- of "nobody's scanned yet").
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
create or replace function get_attendance_dashboard(
    p_start_date    date default null,
    p_end_date      date default null,
    p_department_id bigint default null,
    p_employee_id   uuid default null
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
    and uda.work_date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
    and uda.work_date <= coalesce(p_end_date, current_date)
),

prev_period_rows as (
    select uda.*
    from unified_daily_attendance uda
    where p_start_date is not null and p_end_date is not null
    and (p_department_id is null or uda.department_id = p_department_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
    and uda.work_date >= v_prev_start_date
    and uda.work_date <= v_prev_end_date
),

today_rows as (
    select uda.*
    from unified_daily_attendance uda
    where uda.work_date = current_date
    and (p_department_id is null or uda.department_id = p_department_id)
    and (p_employee_id is null or uda.employee_uuid = p_employee_id)
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
    and aa.clocked_in_at::date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
    and aa.clocked_in_at::date <= coalesce(p_end_date, current_date)
),

-- Point-in-time (ignores the period filter) -- "how long has this been
-- sitting" is about right now, not the selected period.
pending_activity_rows as (
    select aa.*
    from attendance_activities aa
    join employees e on e.id = aa.employee_id
    where aa.approval_status = 'Pending'
    and (p_department_id is null or e.department_id = p_department_id)
    and (p_employee_id is null or aa.employee_id = p_employee_id)
),

kpi_totals as (
    select
        (select headcount from active_headcount_today) as active_headcount_today,

        -- "Present" = has any real check-in data today -- every hr_flag
        -- other than Absent/Weekend implies at least a first_in exists.
        (select count(*) from today_rows where hr_flag not in ('Absent', 'Weekend / Rest Day')) as present_today_count,
        (select count(*) from today_rows where hr_flag = 'Pending App Approval') as pending_approvals_count,
        (select count(*) from today_rows where hr_flag = 'Missing App Check-Out') as missing_checkouts_count,
        (select count(*) from today_rows where hr_flag = 'Incomplete Card Scans') as incomplete_scans_count,

        -- Approval turnaround (Pending Approvals tile's "so what/now what").
        (select round(avg(extract(epoch from (approved_at - clocked_in_at)) / 3600)::numeric, 1)
         from approved_activity_rows) as avg_approval_turnaround_hours,
        (select round(max(extract(epoch from (now() - clocked_in_at)) / 3600)::numeric, 1)
         from pending_activity_rows) as oldest_pending_approval_hours,

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

        (select round(avg(hours_worked)::numeric, 2) from period_rows where hr_flag not in ('Weekend / Rest Day', 'Absent')) as avg_hours_worked,
        (select round(avg(hours_worked)::numeric, 2) from prev_period_rows where hr_flag not in ('Weekend / Rest Day', 'Absent')) as prev_avg_hours_worked,

        -- Overtime (doc-02 KPI): total hours above 8/day, this period.
        (select round(sum(greatest(hours_worked - 8, 0))::numeric, 2) from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent')) as overtime_hours_total,
        (select round(sum(greatest(hours_worked - 8, 0))::numeric, 2) from prev_period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent')) as prev_overtime_hours_total,
        (select count(distinct employee_uuid) from period_rows
         where hr_flag not in ('Weekend / Rest Day', 'Absent') and hours_worked > 8) as employees_with_overtime_count,

        (select count(*) from period_rows where hr_flag = 'Absent') as absent_days_count,
        (select count(*) from prev_period_rows where hr_flag = 'Absent') as prev_absent_days_count,

        -- Denominator for absenteeism/late-arrival rates -- working-day
        -- records only, excluding the Weekend/Rest-Day placeholder rows.
        (select count(*) from period_rows where hr_flag <> 'Weekend / Rest Day') as working_day_records_count
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'activeHeadcountToday', active_headcount_today,
            'presentTodayCount', present_today_count,
            'attendanceRatePct', case when active_headcount_today > 0
                then round((present_today_count::numeric / active_headcount_today) * 100, 1)
                else 0 end,
            'pendingApprovalsCount', pending_approvals_count,
            'missingCheckoutsCount', missing_checkouts_count,
            'incompleteScansCount', incomplete_scans_count,
            'avgApprovalTurnaroundHours', avg_approval_turnaround_hours,
            'oldestPendingApprovalHours', oldest_pending_approval_hours,
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
                else 0 end
        )
        from kpi_totals
    ),

    -- Anomaly/status composition over the period. Weekend/Rest-Day rows are
    -- excluded -- they'd dominate this chart with a huge, uninteresting
    -- bucket on an anomaly-focused view.
    'hrFlagBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select hr_flag as name, count(*) as value
            from period_rows
            where hr_flag <> 'Weekend / Rest Day'
            group by hr_flag
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
                count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day')) as present_count,
                count(*) filter (where hr_flag <> 'Weekend / Rest Day') as roster_count
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
                round(
                    (count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day'))::numeric
                    / nullif(count(*) filter (where hr_flag <> 'Weekend / Rest Day'), 0)) * 100
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
            where hr_flag not in ('Weekend / Rest Day', 'Absent')
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
            where hr_flag not in ('Weekend / Rest Day', 'Absent')
            group by full_name
            having sum(greatest(hours_worked - 8, 0)) > 0
            order by value desc
            limit 10
        ) x
    )

)
into result;

return result;

end;
$$;
