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
-- incompleteScansCount) always read work_date = current_date and ignore
-- p_start_date/p_end_date, same as Finance's AR aging. activeHeadcountToday
-- is read from employees/employment_status directly, NOT from
-- unified_daily_attendance -- that view only produces a row for a given
-- date once at least one scan/activity happens somewhere that day (its own
-- active_company_dates spine), so reading headcount from it would show 0
-- before the first scan of the morning ("nobody's employed" instead of
-- "nobody's scanned yet").
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
begin

-- 1. Calculate the Previous Period for Deltas (mirrors get_hr_employees_dashboard)
if p_start_date is not null and p_end_date is not null then
    v_interval := p_end_date - p_start_date;
    v_prev_end_date := p_start_date - 1;
    v_prev_start_date := v_prev_end_date - v_interval;
end if;

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

kpi_totals as (
    select
        (select headcount from active_headcount_today) as active_headcount_today,

        -- "Present" = has any real check-in data today -- every hr_flag
        -- other than Absent/Weekend implies at least a first_in exists.
        (select count(*) from today_rows where hr_flag not in ('Absent', 'Weekend / Rest Day')) as present_today_count,
        (select count(*) from today_rows where hr_flag = 'Pending App Approval') as pending_approvals_count,
        (select count(*) from today_rows where hr_flag = 'Missing App Check-Out') as missing_checkouts_count,
        (select count(*) from today_rows where hr_flag = 'Incomplete Card Scans') as incomplete_scans_count,

        (select round(avg(hours_worked)::numeric, 2) from period_rows where hr_flag not in ('Weekend / Rest Day', 'Absent')) as avg_hours_worked,
        (select round(avg(hours_worked)::numeric, 2) from prev_period_rows where hr_flag not in ('Weekend / Rest Day', 'Absent')) as prev_avg_hours_worked,

        (select count(*) from period_rows where hr_flag = 'Absent') as absent_days_count,
        (select count(*) from prev_period_rows where hr_flag = 'Absent') as prev_absent_days_count,

        -- Denominator for absenteeism rate -- working-day records only,
        -- excluding the Weekend/Rest-Day placeholder rows.
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
            'avgHoursWorked', coalesce(avg_hours_worked, 0),
            'prevAvgHoursWorked', prev_avg_hours_worked,
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

    -- Date x present-count/roster-count, period-bound. Frontend derives the
    -- daily attendance-rate line from these two raw counts.
    'dailyAttendanceTrendData', (
        select coalesce(json_agg(x order by x.work_date), '[]'::json)
        from (
            select
                to_char(work_date, 'YYYY-MM-DD') as period,
                work_date,
                count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day')) as present_count,
                count(*) filter (where hr_flag <> 'Weekend / Rest Day') as roster_count
            from period_rows
            group by work_date
        ) x
    ),

    -- Date x average hours worked that day (working-day records only).
    'hoursWorkedTrendData', (
        select coalesce(json_agg(x order by x.work_date), '[]'::json)
        from (
            select
                to_char(work_date, 'YYYY-MM-DD') as period,
                work_date,
                round(avg(hours_worked) filter (where hr_flag not in ('Weekend / Rest Day', 'Absent'))::numeric, 2) as avg_hours
            from period_rows
            group by work_date
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
    )

)
into result;

return result;

end;
$$;
