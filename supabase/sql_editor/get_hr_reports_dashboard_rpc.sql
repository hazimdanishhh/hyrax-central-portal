-- get_hr_reports_dashboard: backs the HR Reports page
-- (src/pages/user/hr/hrReports/HRReports.jsx).
--
-- Tier-3 "Reports" RPC (cross-submodule: Employees + Attendance + Leave +
-- Employee Lifecycle), matching get_sales_reports_dashboard/
-- get_finance_dashboard's own shape exactly -- one dedicated function that
-- blends CTEs directly over near-raw tables (unified_daily_attendance,
-- leave_ledger_entries, employee_lifecycle_cases, employees) into one
-- json_build_object. Deliberately does NOT call get_hr_employees_dashboard/
-- get_attendance_dashboard -- Reports pages in this app are always
-- self-contained, never delegate to another dashboard RPC (see Sales
-- Reports' own base_invoice_lines-style CTEs, which query sap_invoices
-- directly rather than calling get_sales_leads_dashboard).
--
-- Several formulas here intentionally duplicate get_hr_employees_dashboard/
-- get_attendance_dashboard's own logic verbatim (status_bucket via
-- employment_status.category, confirmation_due_date, present/roster ratio,
-- leave day_fraction sums) -- kept in sync by copy, not by calling those
-- RPCs, per the same Reports-RPC convention above. If those formulas change,
-- this file needs the matching update.
--
-- No self/manager scoping (p_employee_id/p_manager_id) -- unlike Attendance,
-- this page has no "My"/"Team" variant. Matches get_hr_employees_dashboard's
-- own 3-param shape, plus p_work_location_id (added for the work_locations
-- rollout, see docs/WORK-LOCATIONS-ARCHITECTURE.md). OVERLOAD WARNING
-- applies here too: run DROP FUNCTION on the prior 3-param signature before
-- redeploying this 4-param one.
create or replace function get_hr_reports_dashboard(
    p_start_date    date default null,
    p_end_date      date default null,
    p_department_id bigint default null,
    p_work_location_id bigint default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_role_name text;
    v_department_sub text;
begin

-- 0. Authorization guard (built in from day one -- see
-- get_attendance_dashboard_rpc.sql/get_hr_employees_dashboard_rpc.sql for
-- the two adjacent gaps of this exact same shape found and fixed this same
-- pass). unified_daily_attendance carries no security_invoker, and this RPC
-- also reads employees/leave_ledger_entries/employee_lifecycle_cases
-- directly -- without a guard, any authenticated user could call this RPC
-- with no filters and get every one of these figures company-wide. Mirrors
-- get_finance_dashboard_rpc.sql's exact guard pattern: HR/MGM manager or
-- superadmin only, since this page's target gate (already recorded in
-- supabase/access-control/route_access_matrix.csv) is HR;MGM departments +
-- manager role -- a stricter gate than get_hr_employees_dashboard's
-- (HR-department, any role), because this is the Tier-3 Reports page, not
-- the Tier-2 Overview.
select r.name, d.sub into v_role_name, v_department_sub
from profiles p
join roles r on r.id = p.role_id
join departments d on d.id = p.department_id
where p.id = auth.uid();

if v_role_name is distinct from 'superadmin'
   and not (v_role_name = 'manager' and v_department_sub in ('HR', 'MGM'))
then
    raise exception 'Unauthorized: get_hr_reports_dashboard requires HR/MGM manager or superadmin' using errcode = '42501';
end if;

with

-- ============================================================
-- EMPLOYEES
-- ============================================================

-- Mirrors get_hr_employees_dashboard_rpc.sql's own base_employees CTE
-- exactly (status_bucket from employment_status.category, departure_date
-- coalescing end_date/resignation_date, confirmation_due_date = join_date +
-- 6 months) -- see that file's header comment for the full rationale.
base_employees as (
    select
        e.id,
        e.department_id,
        e.manager_id,
        e.profile_id,
        e.join_date,
        e.full_name,
        coalesce(es.category, 'inactive') as status_bucket,
        es.name as employment_status_name,
        coalesce(e.end_date, e.resignation_date) as departure_date,
        (e.join_date + interval '6 months')::date as confirmation_due_date,
        e.confirmation_date
    from employees e
    left join employment_status es on es.id = e.employment_status_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
),

employees_kpi_totals as (
    select
        count(*) filter (where status_bucket = 'active') as active_headcount,

        count(*) filter (
            where (p_start_date is null or join_date >= p_start_date)
            and (p_end_date is null or join_date <= p_end_date)
        ) as hires_in_period,

        count(*) filter (
            where status_bucket = 'terminated'
            and (p_start_date is null or departure_date >= p_start_date)
            and (p_end_date is null or departure_date <= p_end_date)
        ) as departures_in_period,

        -- 0 when p_start_date is null (all-time view) -- same convention as
        -- get_hr_employees_dashboard's beginning_headcount.
        count(*) filter (
            where p_start_date is not null
            and join_date <= p_start_date - 1
            and (departure_date is null or departure_date > p_start_date - 1)
        ) as beginning_headcount,

        count(*) filter (
            where join_date <= coalesce(p_end_date, current_date)
            and (departure_date is null or departure_date > coalesce(p_end_date, current_date))
        ) as ending_headcount,

        -- "Needs Attention" section inputs -- same OR-of-cohorts formulas as
        -- get_hr_employees_dashboard's Data Gaps / HR Actions Needed tiles.
        count(*) filter (
            where status_bucket = 'active'
            and (manager_id is null or department_id is null or profile_id is null)
        ) as data_gaps_count,
        count(*) filter (where status_bucket = 'active' and manager_id is null) as no_manager_count,
        count(*) filter (where status_bucket = 'active' and department_id is null) as no_department_count,
        count(*) filter (where status_bucket = 'active' and profile_id is null) as no_profile_count,
        count(*) filter (
            where status_bucket = 'active'
            and employment_status_name <> 'Probation'
            and confirmation_date is null
            and confirmation_due_date < current_date
        ) as status_mismatch_count,
        count(*) filter (
            where employment_status_name = 'Probation'
            and confirmation_date is null
            and confirmation_due_date between current_date and current_date + interval '30 days'
        ) as confirmations_due_soon_count,
        count(*) filter (
            where employment_status_name = 'Probation'
            and confirmation_date is null
            and confirmation_due_date < current_date
        ) as late_confirmations_count
    from base_employees
),

kpi_employees_final as (
    select *,
        round((beginning_headcount + ending_headcount) / 2.0, 1) as avg_headcount
    from employees_kpi_totals
),

-- ============================================================
-- ATTENDANCE (reads unified_daily_attendance directly -- that view already
-- owns the 3-source hardware/app/leave reconciliation, no need to re-derive
-- it here)
-- ============================================================

period_attendance as (
    select uda.*
    from unified_daily_attendance uda
    where (p_department_id is null or uda.department_id = p_department_id)
    and (p_work_location_id is null or uda.work_location_id = p_work_location_id)
    and uda.work_date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
    and uda.work_date <= coalesce(p_end_date, current_date)
),

kpi_attendance_totals as (
    select
        count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day') and not is_on_leave) as present_count,
        count(*) filter (where hr_flag <> 'Weekend / Rest Day' and not is_on_leave) as roster_count,
        -- Overtime: time worked after 6PM, not hours above 8/day -- reads
        -- overtime_hours from unified_daily_attendance directly (computed
        -- once there, see that view's own comment), mirrors the identical
        -- fix in get_attendance_dashboard_rpc.sql this same pass.
        round(sum(overtime_hours) filter (
            where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave
        )::numeric, 2) as overtime_hours_total,
        count(distinct employee_uuid) filter (
            where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave and overtime_hours > 0
        ) as employees_with_overtime_count
    from period_attendance
),

-- ============================================================
-- LEAVE (mirrors the employee_leave_rows CTE just added to
-- get_attendance_dashboard_rpc.sql this same session)
-- ============================================================

period_leave as (
    select
        le.employee_id as leave_emp_uuid,
        lt.label as leave_type_label,
        le.day_fraction
    from leave_ledger_entries le
    join leave_ledger_types lt on lt.id = le.leave_type_id
    join employees e on e.id = le.employee_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
    and le.leave_date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
    and le.leave_date <= coalesce(p_end_date, current_date)
),

kpi_leave_totals as (
    select
        coalesce(sum(day_fraction), 0) as leave_days_count,
        count(distinct leave_emp_uuid) as employees_on_leave_count
    from period_leave
),

-- ============================================================
-- EMPLOYEE LIFECYCLE (onboarding/offboarding) -- genuinely new SQL: no
-- server-side aggregation exists anywhere today, the existing 3 tiles on
-- the Lifecycle Case List are 100% client-side over an unfiltered fetch.
-- "Stuck" mirrors that same client-side definition exactly (OPEN and
-- now() - opened_at > 14 days), case-type-agnostic, so this page's numbers
-- can't disagree with the Lifecycle Case List's own tiles.
-- ============================================================

period_lifecycle as (
    select c.*
    from employee_lifecycle_cases c
    join employees e on e.id = c.employee_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
),

kpi_lifecycle_totals as (
    select
        count(*) filter (where case_type = 'ONBOARDING' and status = 'OPEN') as open_onboarding_count,
        count(*) filter (where case_type = 'OFFBOARDING' and status = 'OPEN') as open_offboarding_count,

        count(*) filter (
            where case_type = 'ONBOARDING' and status = 'COMPLETED'
            and closed_at::date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
            and closed_at::date <= coalesce(p_end_date, current_date)
        ) as onboarding_completed_in_period,
        count(*) filter (
            where case_type = 'OFFBOARDING' and status = 'COMPLETED'
            and closed_at::date >= coalesce(p_start_date, date_trunc('month', current_date)::date)
            and closed_at::date <= coalesce(p_end_date, current_date)
        ) as offboarding_completed_in_period,

        round((avg(extract(epoch from (closed_at - opened_at)) / 86400.0) filter (
            where case_type = 'ONBOARDING' and status = 'COMPLETED'
        ))::numeric, 1) as avg_onboarding_days_to_complete,
        round((avg(extract(epoch from (closed_at - opened_at)) / 86400.0) filter (
            where case_type = 'OFFBOARDING' and status = 'COMPLETED'
        ))::numeric, 1) as avg_offboarding_days_to_complete,

        count(*) filter (
            where case_type = 'ONBOARDING' and status = 'OPEN' and now() - opened_at > interval '14 days'
        ) as onboarding_stuck_count,
        count(*) filter (
            where case_type = 'OFFBOARDING' and status = 'OPEN' and now() - opened_at > interval '14 days'
        ) as offboarding_stuck_count
    from period_lifecycle
)

select json_build_object(

    'kpis', (
        select json_build_object(
            -- Employees
            'activeHeadcount', ke.active_headcount,
            'hiresInPeriod', ke.hires_in_period,
            'departuresInPeriod', ke.departures_in_period,
            'attritionRatePct', case when ke.avg_headcount > 0
                then round((ke.departures_in_period::numeric / ke.avg_headcount) * 100, 1)
                else 0 end,
            -- Attendance
            'attendanceRatePct', case when ka.roster_count > 0
                then round((ka.present_count::numeric / ka.roster_count) * 100, 1)
                else 0 end,
            'absenteeismRatePct', case when ka.roster_count > 0
                then round(((ka.roster_count - ka.present_count)::numeric / ka.roster_count) * 100, 1)
                else 0 end,
            'overtimeHoursTotal', coalesce(ka.overtime_hours_total, 0),
            'employeesWithOvertimeCount', ka.employees_with_overtime_count,
            -- Leave
            'leaveDaysCount', kl.leave_days_count,
            'employeesOnLeaveCount', kl.employees_on_leave_count,
            -- Lifecycle
            'openOnboardingCount', klc.open_onboarding_count,
            'onboardingCompletedInPeriod', klc.onboarding_completed_in_period,
            'avgOnboardingDaysToComplete', klc.avg_onboarding_days_to_complete,
            'openOffboardingCount', klc.open_offboarding_count,
            'offboardingCompletedInPeriod', klc.offboarding_completed_in_period,
            'avgOffboardingDaysToComplete', klc.avg_offboarding_days_to_complete,
            -- Needs Attention
            'dataGapsCount', ke.data_gaps_count,
            'noManagerCount', ke.no_manager_count,
            'noDepartmentCount', ke.no_department_count,
            'noProfileCount', ke.no_profile_count,
            'statusMismatchCount', ke.status_mismatch_count,
            'confirmationsDueSoonCount', ke.confirmations_due_soon_count,
            'lateConfirmationsCount', ke.late_confirmations_count,
            'onboardingStuckCount', klc.onboarding_stuck_count,
            'offboardingStuckCount', klc.offboarding_stuck_count
        )
        from kpi_employees_final ke, kpi_attendance_totals ka, kpi_leave_totals kl, kpi_lifecycle_totals klc
    ),

    -- ============================================================
    -- SECTION 2: THE EMPLOYEE JOURNEY
    -- ============================================================

    'onboardingFunnelData', (
        select json_build_array(
            json_build_object('name', 'Still Open', 'value', open_onboarding_count),
            json_build_object('name', 'Completed This Period', 'value', onboarding_completed_in_period),
            json_build_object('name', 'Stuck (>14d)', 'value', onboarding_stuck_count)
        )
        from kpi_lifecycle_totals
    ),

    'offboardingFunnelData', (
        select json_build_array(
            json_build_object('name', 'Still Open', 'value', open_offboarding_count),
            json_build_object('name', 'Completed This Period', 'value', offboarding_completed_in_period),
            json_build_object('name', 'Stuck (>14d)', 'value', offboarding_stuck_count)
        )
        from kpi_lifecycle_totals
    ),

    -- ============================================================
    -- SECTION 4: WORKFORCE COMPOSITION & MOVEMENT
    -- ============================================================

    'headcountTrendData', (
        select coalesce(json_agg(x order by x.month_start), '[]'::json)
        from (
            select
                to_char(gs.month_start, 'YYYY-MM') as period,
                gs.month_start,
                count(*) filter (
                    where e2.join_date <= (gs.month_start + interval '1 month' - interval '1 day')::date
                    and (e2.departure_date is null or e2.departure_date > (gs.month_start + interval '1 month' - interval '1 day')::date)
                ) as headcount
            from generate_series(
                date_trunc('month', coalesce(p_start_date, (select min(join_date) from base_employees))),
                date_trunc('month', coalesce(p_end_date, current_date)),
                interval '1 month'
            ) as gs(month_start)
            cross join base_employees e2
            group by gs.month_start
        ) x
    ),

    -- New for the Reports altitude -- Employee Overview only has the
    -- snapshot trend above, not a movement trend. Same generate_series
    -- bucketing technique.
    'hiresVsDeparturesTrendData', (
        select coalesce(json_agg(x order by x.month_start), '[]'::json)
        from (
            select
                to_char(gs.month_start, 'YYYY-MM') as period,
                gs.month_start,
                count(*) filter (
                    where e2.join_date >= gs.month_start
                    and e2.join_date < gs.month_start + interval '1 month'
                ) as hires,
                count(*) filter (
                    where e2.status_bucket = 'terminated'
                    and e2.departure_date >= gs.month_start
                    and e2.departure_date < gs.month_start + interval '1 month'
                ) as departures
            from generate_series(
                date_trunc('month', coalesce(p_start_date, (select min(join_date) from base_employees))),
                date_trunc('month', coalesce(p_end_date, current_date)),
                interval '1 month'
            ) as gs(month_start)
            cross join base_employees e2
            group by gs.month_start
        ) x
    ),

    'departmentCompositionData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select coalesce(d.name, 'Unassigned') as name, count(*) as value
            from base_employees be
            left join departments d on d.id = be.department_id
            where be.status_bucket = 'active'
            group by coalesce(d.name, 'Unassigned')
        ) x
    ),

    'employmentTypeData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select coalesce(et.name, 'Unspecified') as name, count(*) as value
            from employees e
            left join employment_type et on et.id = e.employment_type_id
            left join employment_status es on es.id = e.employment_status_id
            where (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
            and coalesce(es.category, 'inactive') = 'active'
            group by coalesce(et.name, 'Unspecified')
        ) x
    ),

    'tenureDistributionData', (
        select coalesce(json_agg(x order by x.sort_order), '[]'::json)
        from (
            select band as name, count(*) as value, sort_order
            from (
                select
                    case
                        when join_date is null then 'Unknown'
                        when current_date - join_date < 365 then '< 1 year'
                        when current_date - join_date < 365 * 3 then '1-3 years'
                        when current_date - join_date < 365 * 5 then '3-5 years'
                        when current_date - join_date < 365 * 10 then '5-10 years'
                        else '10+ years'
                    end as band,
                    case
                        when join_date is null then 6
                        when current_date - join_date < 365 then 1
                        when current_date - join_date < 365 * 3 then 2
                        when current_date - join_date < 365 * 5 then 3
                        when current_date - join_date < 365 * 10 then 4
                        else 5
                    end as sort_order
                from base_employees
                where status_bucket = 'active'
            ) banded
            group by band, sort_order
        ) x
    ),

    -- ============================================================
    -- SECTION 5: DAY-TO-DAY -- ATTENDANCE & LEAVE
    -- ============================================================

    'attendanceRateTrendData', (
        select coalesce(json_agg(x order by x.bucket_start), '[]'::json)
        from (
            select
                to_char(date_trunc('month', work_date), 'YYYY-MM') as period,
                date_trunc('month', work_date) as bucket_start,
                count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day') and not is_on_leave) as present_count,
                count(*) filter (where hr_flag <> 'Weekend / Rest Day' and not is_on_leave) as roster_count
            from period_attendance
            group by date_trunc('month', work_date)
        ) x
    ),

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
            from period_attendance
            where hr_flag not in ('Weekend / Rest Day', 'Absent') and not is_on_leave
            group by 1
        ) x
    ),

    'leaveTypeBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select leave_type_label as name, sum(day_fraction) as value
            from period_leave
            group by leave_type_label
        ) x
    ),

    'hrFlagBreakdownData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select
                case when hr_flag like 'On Leave%' then 'On Leave' else hr_flag end as name,
                count(*) as value
            from period_attendance
            where hr_flag <> 'Weekend / Rest Day'
            group by 1
        ) x
    ),

    -- ============================================================
    -- SECTION 6: BY DEPARTMENT & MANAGER
    -- ============================================================

    'departmentAttendanceData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select
                coalesce(department_name, 'Unassigned') as name,
                round(
                    (count(*) filter (where hr_flag not in ('Absent', 'Weekend / Rest Day') and not is_on_leave)::numeric
                    / nullif(count(*) filter (where hr_flag <> 'Weekend / Rest Day' and not is_on_leave), 0)) * 100
                , 1) as value
            from period_attendance
            group by coalesce(department_name, 'Unassigned')
        ) x
    ),

    -- Simplified proxy, not the exact avg-beginning/ending-headcount
    -- methodology the headline attritionRatePct KPI uses: departures this
    -- period divided by CURRENT active headcount in that department (not a
    -- per-department historical reconstruction, which would need its own
    -- generate_series pass per department). Good enough to spot which
    -- department is losing people fastest; not intended to sum to the
    -- headline attrition figure.
    'departmentAttritionData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select
                coalesce(d.name, 'Unassigned') as name,
                round(
                    (count(*) filter (
                        where be.status_bucket = 'terminated'
                        and (p_start_date is null or be.departure_date >= p_start_date)
                        and (p_end_date is null or be.departure_date <= p_end_date)
                    )::numeric
                    / nullif(count(*) filter (where be.status_bucket = 'active'), 0)) * 100
                , 1) as value
            from base_employees be
            left join departments d on d.id = be.department_id
            group by coalesce(d.name, 'Unassigned')
        ) x
    ),

    'topManagersData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select m.id, m.full_name as name, count(*) as value
            from base_employees be
            join employees m on m.id = be.manager_id
            where be.status_bucket = 'active'
            group by m.id, m.full_name
            order by count(*) desc
            limit 5
        ) x
    )

)
into result;

return result;

end;
$$;
