-- get_hr_employees_dashboard: backs the HR Employee Overview page
-- (src/pages/user/hr/employeeManagement/overview/EmployeeOverview.jsx).
--
-- Tier-2 Overview RPC (single entity: Employees), not a Tier-3 "Reports"
-- page -- named to match get_sales_leads_dashboard's convention
-- (get_<entity>_dashboard), not get_..._reports_dashboard, since a future
-- cross-submodule HR Reports RPC is a separate, later piece of work.
--
-- Scoped strictly to `employees`-table data: no attendance (its own future
-- dedicated Overview), no leave/recruitment/performance (folded into the
-- future HR Reports page instead). Queries the raw `employees` table
-- directly, not the `employees_public` view -- that view does 3 `left join
-- lateral` subqueries per row against attendance_activities/attendance_logs
-- to compute real-time clock-in status, which this aggregate dashboard
-- doesn't need and shouldn't pay for.
--
-- No freshness banner / sap_pipeline_state concept applies here --
-- `employees` is app-authored/CRUD data, not SAP-pipeline-ingested, so
-- there's no external pipeline that can lag or fail. This RPC is always as
-- current as the moment it's called.
create or replace function get_hr_employees_dashboard(
    p_start_date        date default null,
    p_end_date          date default null,
    p_department_id     bigint default null,
    p_work_location_id  bigint default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_interval integer;
    -- REGULAR family's effective range (2026-09-28, mirrors
    -- get_attendance_dashboard_rpc.sql's own fix exactly) -- defaults to the
    -- FULL current month (not month-to-date) when unfiltered, uniform across
    -- every REGULAR metric on this page (New Hires, Departures, Attrition
    -- Rate, Termination Reasons). headcountTrendData deliberately does NOT
    -- use this -- see that field's own comment.
    v_effective_start_date date;
    v_effective_end_date date;
    v_prev_start_date date;
    v_prev_end_date date;
begin

-- 0. Authorization guard (added for HR Reports hardening pass): this RPC
-- queries `employees` directly with no RLS-transparent view in between, and
-- had no in-body auth check at all -- any authenticated user could call it
-- directly (bypassing the frontend's hr/employees/overview AccessRoute
-- gate) and get back every active employee's name/tenure/age/department
-- company-wide. Tier-2 Overview page, open to any HR staff (no manager
-- restriction, R3 convention) -- simpler guard than the Tier-3 Reports RPCs
-- (get_finance_dashboard/get_hr_reports_dashboard), which additionally
-- require manager role. Mirrors sync_leave_ledger_from_snapshot's exact
-- department-only pattern instead.
if not (
    public.is_superadmin()
    or exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    )
) then
    raise exception 'Unauthorized: get_hr_employees_dashboard requires HR department or superadmin' using errcode = '42501';
end if;

-- 1. Effective range for REGULAR metrics + previous-period calculation for
-- deltas (2026-09-28, mirrors get_attendance_dashboard_rpc.sql's own fix).
-- Defaults to the FULL current month (not month-to-date) when unfiltered --
-- an in-progress month still compares against a complete previous month,
-- not a partial one. Always computed now (previously only ran when the
-- caller explicitly sent both dates), so a "vs last period" delta appears
-- on first load too, same reasoning as Attendance's own fix.
v_effective_start_date := coalesce(p_start_date, date_trunc('month', current_date)::date);
v_effective_end_date := coalesce(p_end_date, (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date);

v_interval := v_effective_end_date - v_effective_start_date;
v_prev_end_date := v_effective_start_date - 1;
v_prev_start_date := v_prev_end_date - v_interval;

-- Status-bucket classification, computed once and reused everywhere below.
-- Sourced from employment_status.category (see
-- hyrax-data-platform/infrastructure/employment_status_category_migration.sql)
-- instead of a hardcoded name list -- this used to be a local `case/in`
-- block here, which was also the ONLY place this bucket was documented; it
-- has since been found to disagree with at least three other places in the
-- app that each re-derived their own version (Organization Chart, public
-- employee directory, attendance's unified_daily_attendance view). Now
-- every consumer reads the same DB column, so this can't drift again.
--   active     (currently working): Active, Probation, On Leave, Sabbatical
--   terminated (separated): Terminated, Resigned, Retired, Terminated Notice
--   inactive   (administrative hold, not separated): Inactive, Suspended
with base_employees as (
    select
        e.*,
        coalesce(es.category, 'inactive') as status_bucket,
        et.name as employment_type_name,
        es.name as employment_status_name,
        -- Departures use end_date as the authoritative separation date,
        -- falling back to resignation_date if end_date wasn't recorded.
        -- Every departure-driven metric in this RPC (departures_in_period,
        -- beginning/ending_headcount, headcountTrendData,
        -- terminationReasonsData) reads this same column, not raw end_date
        -- -- keeps them from disagreeing with each other when only
        -- resignation_date got recorded for a given separation.
        -- CAVEAT: if HR's historical data entry didn't reliably populate
        -- either date whenever someone actually left, this field and every
        -- metric built on it will undercount past departures -- this isn't
        -- an approximation Postgres can fix, it depends on the underlying
        -- data being complete.
        coalesce(e.end_date, e.resignation_date) as departure_date,
        -- Company policy: probation confirmation is due 6 months after
        -- join_date. confirmation_date itself is an ACTUAL-event field (only
        -- populated once HR processes the confirmation), not a scheduled
        -- date -- this derived column is the scheduled/target date, used
        -- below to split "due soon" from "already overdue".
        (e.join_date + interval '6 months')::date as confirmation_due_date
    from employees e
    left join employment_status es on es.id = e.employment_status_id
    left join employment_type et on et.id = e.employment_type_id
    where (p_department_id is null or e.department_id = p_department_id)
    and (p_work_location_id is null or e.work_location_id = p_work_location_id)
),

employees_agg as (
    select
        count(*) filter (where status_bucket = 'active') as active_headcount,

        round(
            (avg(current_date - join_date) filter (
                where status_bucket = 'active' and join_date is not null
            ))::numeric / 365.25,
            1
        ) as avg_tenure_years,

        round(
            (avg(current_date - date_of_birth) filter (
                where status_bucket = 'active' and date_of_birth is not null
            ))::numeric / 365.25,
            1
        ) as avg_age_years,

        count(*) filter (where status_bucket = 'active' and manager_id is not null) as active_with_manager,

        count(distinct manager_id) filter (
            where status_bucket = 'active' and manager_id is not null
        ) as distinct_active_managers,

        count(*) filter (
            where status_bucket = 'active'
            and (manager_id is null or department_id is null or profile_id is null)
        ) as data_gaps_count,

        count(*) filter (where status_bucket = 'active' and manager_id is null) as no_manager_count,
        count(*) filter (where status_bucket = 'active' and department_id is null) as no_department_count,
        count(*) filter (where status_bucket = 'active' and profile_id is null) as no_profile_count,

        count(*) filter (where status_bucket = 'active' and employment_status_name = 'Probation') as probation_count,
        count(*) as total_workforce_count,

        count(*) filter (
            where join_date >= v_effective_start_date and join_date <= v_effective_end_date
        ) as hires_in_period,

        count(*) filter (
            where join_date >= v_prev_start_date and join_date <= v_prev_end_date
        ) as prev_hires_in_period,

        count(*) filter (where join_date >= date_trunc('year', current_date)) as ytd_hires_count,

        count(*) filter (
            where status_bucket = 'terminated'
            and departure_date >= v_effective_start_date and departure_date <= v_effective_end_date
        ) as departures_in_period,

        count(*) filter (
            where status_bucket = 'terminated'
            and departure_date >= v_prev_start_date and departure_date <= v_prev_end_date
        ) as prev_departures_in_period,

        count(*) filter (
            where status_bucket = 'terminated'
            and departure_date >= date_trunc('year', current_date)
        ) as ytd_departures_count,

        -- Exact historical headcount reconstruction -- NOT an approximation
        -- (unlike Finance's DSO Beginning-AR derivation): employees carries
        -- a real join_date/departure_date per person, so "headcount as of
        -- any past date X" is just "joined on/before X and not yet
        -- separated as of X". Uses departure_date (coalesce(end_date,
        -- resignation_date)), NOT raw end_date, so this stays consistent
        -- with departures_in_period/terminationReasonsData below -- an
        -- employee separated via resignation_date only (no end_date) must
        -- drop out of headcount the same moment they're counted as a
        -- departure, not linger as "active" indefinitely.
        -- Uses v_effective_start_date now (2026-09-28) -- always a real
        -- bound (This Month by default), so the "0 when no start date"
        -- all-time special case is gone: there's always an effective start
        -- date to reconstruct headcount as of.
        count(*) filter (
            where join_date <= v_effective_start_date - 1
            and (departure_date is null or departure_date > v_effective_start_date - 1)
        ) as beginning_headcount,

        count(*) filter (
            where join_date <= v_effective_end_date
            and (departure_date is null or departure_date > v_effective_end_date)
        ) as ending_headcount,

        -- Prior-period siblings (2026-09-28), for activeHeadcount/
        -- attritionRatePct's own subvalue deltas. prevActiveHeadcount is the
        -- best available comparison for activeHeadcount: employees carries
        -- only CURRENT employment_status, not a historical per-day
        -- snapshot, so there's no way to ask "what was the status-bucket
        -- count as of a past date" the same way activeHeadcount itself is
        -- computed -- this date-reconstructed count (headcount as of the
        -- end of the previous period) is the equivalent fact one period
        -- back.
        count(*) filter (
            where join_date <= v_prev_start_date - 1
            and (departure_date is null or departure_date > v_prev_start_date - 1)
        ) as prev_beginning_headcount,

        count(*) filter (
            where join_date <= v_prev_end_date
            and (departure_date is null or departure_date > v_prev_end_date)
        ) as prev_ending_headcount,

        -- Confirmation is due 6 months after join_date (company policy).
        -- Scoped to Probation specifically, not the whole active bucket --
        -- On Leave/Sabbatical/full Active employees were never subject to
        -- this check. confirmation_date is null here means "not yet
        -- confirmed" (the actual-event field hasn't been set), which is
        -- what makes someone eligible for either bucket below.
        count(*) filter (
            where employment_status_name = 'Probation'
            and confirmation_date is null
            and confirmation_due_date between current_date and current_date + interval '30 days'
        ) as confirmations_due_soon_count,

        -- Already past the 6-month mark and still not confirmed -- a real
        -- process/compliance gap, not just an upcoming reminder.
        count(*) filter (
            where employment_status_name = 'Probation'
            and confirmation_date is null
            and confirmation_due_date < current_date
        ) as late_confirmations_count,

        -- Data-hygiene flag, deliberately separate from late_confirmations_count
        -- above: catches someone HR moved OFF Probation status (e.g. to
        -- Active) without ever actually confirming them (confirmation_date
        -- still null) and who's already past their 6-month mark. The two
        -- counts are mutually exclusive by construction ('Probation' vs
        -- <> 'Probation') -- this doesn't change what late_confirmations_count
        -- means, it just surfaces the status/date drift as its own signal.
        count(*) filter (
            where status_bucket = 'active'
            and employment_status_name <> 'Probation'
            and confirmation_date is null
            and confirmation_due_date < current_date
        ) as status_mismatch_count,

        -- Exclude-'full-time' filter, not an include-'%contract%' match --
        -- kept identical to check_employee_contract_actions_due.sql's own
        -- redesign (2026-09): the "contract" substring match was confirmed
        -- against live data to be too narrow (misses part-time/intern/
        -- temporary/etc.), and this KPI had drifted out of sync with that
        -- fix until now. employment_type_name is null-safe the same way --
        -- `null not ilike 'full-time'` is unknown, not true, so an employee
        -- with no employment_type_id set stays excluded rather than
        -- assumed non-permanent.
        count(*) filter (
            where status_bucket = 'active'
            and employment_type_name not ilike 'full-time'
            and end_date is not null
            and end_date between current_date and current_date + interval '30 days'
        ) as contract_actions_due_count

    from base_employees
),

kpi_totals as (
    select
        *,
        round((beginning_headcount + ending_headcount) / 2.0, 1) as avg_headcount,
        round((prev_beginning_headcount + prev_ending_headcount) / 2.0, 1) as prev_avg_headcount,
        round(active_with_manager::numeric / nullif(distinct_active_managers, 0), 1) as avg_span_of_control
    from employees_agg
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'activeHeadcount', active_headcount,
            -- Prior-period sibling (2026-09-28), for the tile's own subvalue
            -- delta -- see prev_ending_headcount's own declaration comment.
            'prevActiveHeadcount', prev_ending_headcount,
            'avgTenureYears', coalesce(avg_tenure_years, 0),
            'avgAgeYears', coalesce(avg_age_years, 0),
            'managementCoveragePct', case when active_headcount > 0
                then round((active_with_manager::numeric / active_headcount) * 100)
                else 0 end,
            'activeWithManager', active_with_manager,
            'avgSpanOfControl', coalesce(avg_span_of_control, 0),
            'dataGapsCount', data_gaps_count,
            'noManagerCount', no_manager_count,
            'noDepartmentCount', no_department_count,
            'noProfileCount', no_profile_count,
            'statusMismatchCount', status_mismatch_count,
            'probationCount', probation_count,
            'totalWorkforceCount', total_workforce_count,
            'hiresInPeriod', hires_in_period,
            'prevHiresInPeriod', prev_hires_in_period,
            'ytdHiresCount', ytd_hires_count,
            'departuresInPeriod', departures_in_period,
            'prevDeparturesInPeriod', prev_departures_in_period,
            'ytdDeparturesCount', ytd_departures_count,
            'attritionRatePct', case
                when (beginning_headcount + ending_headcount) > 0
                then round((departures_in_period::numeric / ((beginning_headcount + ending_headcount) / 2.0)) * 100, 1)
                else 0
            end,
            -- Prior-period sibling (2026-09-28) -- null (not 0) when the
            -- prior period had no reconstructed headcount at all, so
            -- calcDelta on the frontend renders "no comparison" rather than
            -- a false swing.
            'prevAttritionRatePct', case
                when (prev_beginning_headcount + prev_ending_headcount) > 0
                then round((prev_departures_in_period::numeric / ((prev_beginning_headcount + prev_ending_headcount) / 2.0)) * 100, 1)
                else null
            end,
            'avgHeadcount', avg_headcount,
            'confirmationsDueSoonCount', confirmations_due_soon_count,
            'lateConfirmationsCount', late_confirmations_count,
            'contractActionsDueCount', contract_actions_due_count
        )
        from kpi_totals
    ),

    -- WORKFORCE COMPOSITION (point-in-time, ignores the date filter)

    -- Chart-element drill-through (2026-09-28, mirrors
    -- get_attendance_dashboard_rpc.sql's own convention): each row's `filter`
    -- is null for an "Unassigned"/"Unspecified" bucket, whose underlying id
    -- is null -- left unclickable rather than risk an ambiguous "is null"
    -- filter the list page doesn't support.
    'departmentData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select coalesce(d.name, 'Unassigned') as name, count(*) as value,
                   case when be.department_id is not null
                       then json_build_object('statusBucket', 'active', 'department', be.department_id)
                       else null end as filter
            from base_employees be
            left join departments d on d.id = be.department_id
            where be.status_bucket = 'active'
            group by coalesce(d.name, 'Unassigned'), be.department_id
        ) x
    ),

    'employmentTypeData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select coalesce(employment_type_name, 'Unspecified') as name, count(*) as value,
                   case when employment_type_id is not null
                       then json_build_object('statusBucket', 'active', 'employmentType', employment_type_id)
                       else null end as filter
            from base_employees
            where status_bucket = 'active'
            group by coalesce(employment_type_name, 'Unspecified'), employment_type_id
        ) x
    ),

    -- No id needed -- these `name` values already match the `gender` filter's
    -- own literal option values exactly (verified against
    -- employeeManagement/list/filterConfig.js).
    'genderData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select coalesce(gender::text, 'Not Specified') as name, count(*) as value,
                   json_build_object('statusBucket', 'active', 'gender', coalesce(gender::text, 'Not Specified')) as filter
            from base_employees
            where status_bucket = 'active'
            group by coalesce(gender::text, 'Not Specified')
        ) x
    ),

    'nationalityData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select coalesce(n.name, 'Unspecified') as name, count(*) as value,
                   case when be.nationality_id is not null
                       then json_build_object('statusBucket', 'active', 'nationality', be.nationality_id)
                       else null end as filter
            from base_employees be
            left join nationalities n on n.id = be.nationality_id
            where be.status_bucket = 'active'
            group by coalesce(n.name, 'Unspecified'), be.nationality_id
        ) x
    ),

    -- Same banding technique as tenureDistributionData below, bucketed by
    -- date_of_birth instead of join_date. "55+" doubles as a nearing-
    -- retirement signal (Malaysia's mandatory retirement age is 60).
    'ageDistributionData', (
        select coalesce(json_agg(x order by x.sort_order), '[]'::json)
        from (
            -- No id needed -- band strings already match the `ageBand`
            -- filter's own option values exactly.
            select band as name, count(*) as value, sort_order,
                   json_build_object('statusBucket', 'active', 'ageBand', band) as filter
            from (
                select
                    case
                        when date_of_birth is null then 'Unknown'
                        when current_date - date_of_birth < 365.25 * 25 then '< 25'
                        when current_date - date_of_birth < 365.25 * 35 then '25-34'
                        when current_date - date_of_birth < 365.25 * 45 then '35-44'
                        when current_date - date_of_birth < 365.25 * 55 then '45-54'
                        else '55+'
                    end as band,
                    case
                        when date_of_birth is null then 6
                        when current_date - date_of_birth < 365.25 * 25 then 1
                        when current_date - date_of_birth < 365.25 * 35 then 2
                        when current_date - date_of_birth < 365.25 * 45 then 3
                        when current_date - date_of_birth < 365.25 * 55 then 4
                        else 5
                    end as sort_order
                from base_employees
                where status_bucket = 'active'
            ) banded
            group by band, sort_order
        ) x
    ),

    -- Absolute-count companion to the "Management Coverage %" KPI tile above
    -- (same pairing Finance uses for e.g. Collection Rate KPI + pie chart).
    'managementCoverageData', (
        select json_build_array(
            json_build_object('name', 'Assigned', 'value', active_with_manager),
            json_build_object('name', 'Unassigned', 'value', active_headcount - active_with_manager)
        )
        from kpi_totals
    ),

    -- MOVEMENT & RETENTION

    -- Monthly, period-bound by p_start_date/p_end_date (same "all-time if
    -- no range selected" convention as Finance's plTrendData) -- lets HR
    -- pick a specific window (e.g. this fiscal year, a past quarter)
    -- instead of always seeing a fixed trailing-12-months snapshot. "All
    -- time" spans from the earliest join_date on record to the current
    -- month, not a fixed lookback. Same exact reconstruction technique as
    -- beginning_headcount/ending_headcount above, applied per month-end
    -- instead of per filter bound.
    --
    -- DELIBERATELY not v_effective_start_date/v_effective_end_date
    -- (2026-09-28 decision) -- unlike every other REGULAR metric on this
    -- page, this is a multi-point trend, not a scalar: a "This Month"
    -- default would render exactly one point, which isn't a trend at all.
    -- Monthly bucketing also doesn't get visually noisy over many years the
    -- way Attendance's daily bucketing did, so there's no rendering reason
    -- to cap it either -- the full growth trajectory is the more useful
    -- story here.
    --
    -- NO per-point `filter` object (2026-09-28) -- deliberately, not an
    -- oversight. Every other trend chart in this app links a point to
    -- "records dated within this range"; a headcount-as-of-a-past-month
    -- snapshot has no equivalent, since the Employee List's own date-range
    -- filter narrows by join_date, not "who was active as of a past date"
    -- -- there's no verified filter that reconstructs point-in-time roster
    -- membership. Left unclickable rather than ship a filter that silently
    -- shows the wrong set of people.
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
            -- base_employees already applies the p_department_id filter --
            -- reused here rather than re-filtering employees directly.
            cross join base_employees e2
            group by gs.month_start
        ) x
    ),

    'tenureDistributionData', (
        select coalesce(json_agg(x order by x.sort_order), '[]'::json)
        from (
            -- No id needed -- band strings already match the `tenureBand`
            -- filter's own option values exactly.
            select band as name, count(*) as value, sort_order,
                   json_build_object('statusBucket', 'active', 'tenureBand', band) as filter
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

    -- id included (not just full_name) so the frontend can link this chart
    -- to ?manager=<id> on the Employee List -- previously had no id to
    -- build that link from at all.
    'topManagersData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select m.id, m.full_name as name, count(*) as value,
                   json_build_object('statusBucket', 'active', 'manager', m.id) as filter
            from base_employees be
            join employees m on m.id = be.manager_id
            where be.status_bucket = 'active'
            group by m.id, m.full_name
            order by count(*) desc
            limit 5
        ) x
    ),

    -- Deliberately period-bound to the SAME v_effective_start_date/
    -- v_effective_end_date as the departuresInPeriod KPI (switched off raw
    -- p_start_date/p_end_date 2026-09-28, same REGULAR default as every
    -- other movement metric on this page), so the two numbers never
    -- disagree (per DASHBOARD-CONVENTIONS.md's source-labeling-clarity
    -- rule).
    'terminationReasonsData', (
        select coalesce(json_agg(x order by x.value desc), '[]'::json)
        from (
            select coalesce(tr.name, 'Not Specified') as name, count(*) as value,
                   case when be.termination_reason_id is not null then
                       json_build_object(
                           'statusBucket', 'terminated',
                           'departureDateFrom', to_char(v_effective_start_date, 'YYYY-MM-DD'),
                           'departureDateTo', to_char(v_effective_end_date, 'YYYY-MM-DD'),
                           'terminationReason', be.termination_reason_id
                       )
                   else
                       json_build_object(
                           'statusBucket', 'terminated',
                           'departureDateFrom', to_char(v_effective_start_date, 'YYYY-MM-DD'),
                           'departureDateTo', to_char(v_effective_end_date, 'YYYY-MM-DD')
                       )
                   end as filter
            from base_employees be
            left join termination_reason tr on tr.id = be.termination_reason_id
            where be.status_bucket = 'terminated'
            and be.departure_date >= v_effective_start_date
            and be.departure_date <= v_effective_end_date
            group by coalesce(tr.name, 'Not Specified'), be.termination_reason_id
        ) x
    )

)
into result;

return result;

end;
$$;
