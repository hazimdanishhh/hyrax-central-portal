create or replace function get_sales_reports_dashboard(
    p_start_date   date default null,
    p_end_date     date default null,
    p_owner_id     uuid default null,
    p_product_type public.product_type default null
)
returns json
language plpgsql
as
$$
declare
    result json;
begin

-- Sales Reports (Tier 3) -- department-level synthesis, distinct from Leads
-- Overview's Tier-2 daily rep-coaching cadence. See
-- hyrax-central-portal/docs/DEPARTMENT-DASHBOARD-BLUEPRINT.md §5.1.
--
-- Surfaces BOTH sales forecasts side by side, never blended into one number
-- (per hyrax-central-portal/docs/DASHBOARD-IA-STRATEGY.md §7):
--   Forecast 1 "Pipeline Target" -- CRM self-reported, sales_targets vs
--     sales_leads.actual_revenue, keyed by lead_owner_id (employees.id).
--   Forecast 2 "Invoice Budget"  -- SAP system-of-record, sales_budgets vs
--     sap_invoices.total_amount_myr, keyed by sales_rep_code. employees/
--     profiles are joined in ONLY to resolve a display name/avatar, via
--     employees.employee_id = sap_sales_persons.employee_id (EmpID) --
--     see docs/DEPARTMENT-DASHBOARD-BLUEPRINT.md §4.1.

with closing_dates as (
    select lead_id, max(changed_at) as closed_date
    from sales_leads_stage_history
    where new_stage in ('WON', 'LOST')
    group by lead_id
),

base_leads as (
    select
        sl.*,
        coalesce(cd.closed_date, case when sl.stage in ('WON', 'LOST') or sl.is_cancelled then sl.updated_at else null end) as closed_date
    from sales_leads sl
    left join closing_dates cd on cd.lead_id = sl.id
    where (p_owner_id is null or sl.lead_owner_id = p_owner_id)
      and (p_product_type is null or sl.product_type = p_product_type)
),

base_invoices as (
    select oi.*
    from sap_invoices oi
    where oi.is_cancelled = 'N'
),

base_orders as (
    select so.*
    from sap_sales_orders so
    where so.is_cancelled = 'N'
),

-- Forecast 1: department-wide prorated CRM pipeline target, summed across
-- every rep with a sales_targets row -- same day-overlap proration formula
-- as get_sales_leads_dashboard's scorecardData (mirrored intentionally, so
-- the two dashboards' attainment math never silently drifts apart).
pipeline_target_math as (
    select
        sum(
            t.target_revenue * (
                case
                    when p_start_date is null and p_end_date is null then 1
                    else
                        greatest(0,
                            (least(coalesce(p_end_date, '2099-12-31'::date), (t.target_month + interval '1 month' - interval '1 day')::date) -
                            greatest(coalesce(p_start_date, '1900-01-01'::date), t.target_month)) + 1
                        ) / extract(day from (t.target_month + interval '1 month' - interval '1 day'))
                end
            )
        ) as prorated_target
    from sales_targets t
    where (p_owner_id is null or t.lead_owner_id = p_owner_id)
),

-- Forecast 2: per-rep prorated invoice budget (identical proration formula,
-- keyed by sales_rep_code instead of lead_owner_id).
budget_math as (
    select
        b.sales_rep_code,
        sum(
            b.budget_revenue * (
                case
                    when p_start_date is null and p_end_date is null then 1
                    else
                        greatest(0,
                            (least(coalesce(p_end_date, '2099-12-31'::date), (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day')::date) -
                            greatest(coalesce(p_start_date, '1900-01-01'::date), date_trunc('month', b.budget_month)::date)) + 1
                        ) / extract(day from (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day'))
                end
            )
        ) as prorated_budget
    from sales_budgets b
    group by b.sales_rep_code
),

rep_invoice_actuals as (
    select
        sales_rep_code,
        coalesce(sum(total_amount_myr), 0) as invoiced_revenue
    from base_invoices
    where (p_start_date is null or "invoice_date"::date >= p_start_date)
      and (p_end_date is null or "invoice_date"::date <= p_end_date)
    group by sales_rep_code
),

lead_kpis as (
    select
        coalesce(sum(actual_revenue) filter (
            where stage = 'WON'
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
        ), 0) as won_revenue,

        coalesce(round(
            (count(*) filter (
                where stage = 'WON'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            )::numeric /
            nullif(count(*) filter (
                where stage in ('WON', 'LOST')
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ), 0)) * 100,
        1), 0) as win_rate_pct,

        coalesce(round(avg(actual_revenue) filter (
            where stage = 'WON'
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
        )), 0) as avg_deal_size,

        coalesce(round(
            (avg(extract(epoch from (closed_date - created_at)) / 86400) filter (
                where stage = 'WON'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ))::numeric,
        1), 0) as avg_days_to_close,

        count(*) filter (
            where quotation_url is not null
            and (p_start_date is null or created_at >= p_start_date)
            and (p_end_date is null or created_at <= p_end_date + interval '1 day')
        ) as quoted_count,

        count(*) filter (
            where quotation_url is not null and stage = 'WON'
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
        ) as quoted_and_won_count,

        coalesce(round(
            (percentile_cont(0.5) within group (
                order by extract(epoch from (closed_date - created_at)) / 86400
            ) filter (
                where quotation_url is not null and stage = 'WON'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ))::numeric,
        1), 0) as median_days_to_win

    from base_leads
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'pipelineTargetRevenue', coalesce(pt.prorated_target, 0),
            'pipelineWonRevenue', lk.won_revenue,
            'pipelineAttainmentPct', case when coalesce(pt.prorated_target, 0) > 0
                then round((lk.won_revenue / pt.prorated_target) * 100)
                else 0 end,

            'orderBookValue', (select coalesce(sum(total_amount_myr), 0) from base_orders
                where (p_start_date is null or "order_date"::date >= p_start_date)
                  and (p_end_date is null or "order_date"::date <= p_end_date)
            ),

            'winRatePct', lk.win_rate_pct,
            'avgDealSize', lk.avg_deal_size,
            'avgDaysToClose', lk.avg_days_to_close,

            'quoteToWinConversionPct', case when lk.quoted_count > 0
                then round((lk.quoted_and_won_count::numeric / lk.quoted_count) * 100, 1)
                else 0 end,
            'medianDaysToWin', lk.median_days_to_win
        )
        from lead_kpis lk
        cross join pipeline_target_math pt
    ),

    -- Forecast 2 scorecard. attainment_percentage is computed purely from
    -- sales_rep_code (SAP identity) -- employees/profiles below are for
    -- display (name/avatar) only, never for the attribution math itself.
    'invoiceBudgetScorecardData', (
        select coalesce(json_agg(
            json_build_object(
                'sales_rep_code', coalesce(a.sales_rep_code, b.sales_rep_code),
                'employee_uuid', e.id,
                'rep_name', coalesce(sp.sales_rep_name, 'Unknown'),
                'avatar_url', p.avatar_url,
                'invoiced_revenue', coalesce(a.invoiced_revenue, 0),
                'budget_revenue', coalesce(b.prorated_budget, 0),
                'attainment_percentage', case
                    when coalesce(b.prorated_budget, 0) > 0
                    then round((coalesce(a.invoiced_revenue, 0) / b.prorated_budget) * 100)
                    else 0
                end
            ) order by coalesce(a.invoiced_revenue, 0) desc
        ), '[]'::json)
        from rep_invoice_actuals a
        full outer join budget_math b on b.sales_rep_code = a.sales_rep_code
        left join sap_sales_persons sp on sp.sales_rep_code = coalesce(a.sales_rep_code, b.sales_rep_code)
        left join employees e on e.employee_id = sp.employee_id::text
        left join profiles p on p.id = e.profile_id
        where coalesce(a.invoiced_revenue, 0) > 0 or coalesce(b.prorated_budget, 0) > 0
    ),

    'orderBookData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                sp.sales_rep_name as name,
                coalesce(sum(so.total_amount_myr), 0) as order_value_myr
            from base_orders so
            join sap_sales_persons sp on sp.sales_rep_code = so.sales_rep_code
            where (p_start_date is null or so."order_date"::date >= p_start_date)
              and (p_end_date is null or so."order_date"::date <= p_end_date)
            group by sp.sales_rep_name
            order by order_value_myr desc
            limit 15
        ) x
    ),

    -- The two systems of record, side by side, never blended (see the file
    -- header comment and docs/DASHBOARD-IA-STRATEGY.md §7).
    'realizedVsPipelineData', (
        with pipeline_by_month as (
            select
                to_char(date_trunc('month', closed_date), 'YYYY-MM') as month,
                sum(actual_revenue) as pipeline_revenue
            from base_leads
            where stage = 'WON'
              and (p_start_date is null or closed_date >= p_start_date)
              and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            group by 1
        ),
        realized_by_month as (
            select
                to_char(date_trunc('month', "invoice_date"::date), 'YYYY-MM') as month,
                sum(total_amount_myr) as realized_revenue
            from base_invoices
            where (p_start_date is null or "invoice_date"::date >= p_start_date)
              and (p_end_date is null or "invoice_date"::date <= p_end_date)
            group by 1
        )
        select coalesce(json_agg(json_build_object(
            'period', coalesce(pm.month, rm.month),
            'pipeline_revenue_myr', coalesce(pm.pipeline_revenue, 0),
            'realized_revenue_myr', coalesce(rm.realized_revenue, 0)
        ) order by coalesce(pm.month, rm.month)), '[]'::json)
        from pipeline_by_month pm
        full outer join realized_by_month rm on rm.month = pm.month
    ),

    'grossProfitByRepData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                sp.sales_rep_name as name,
                coalesce(sum(oi.total_amount_myr), 0) as revenue_myr,
                -- Same GrosProfit outlier guard as get_finance_dashboard --
                -- SAP's own GP field carries a known item-cost master-data
                -- defect at the extremes.
                coalesce(sum(
                    case
                        when oi.total_amount_myr <> 0 and abs(oi.gross_profit) > abs(oi.total_amount_myr) * 5
                        then null
                        else oi.gross_profit
                    end
                ), 0) as gross_profit_myr
            from base_invoices oi
            join sap_sales_persons sp on sp.sales_rep_code = oi.sales_rep_code
            where (p_start_date is null or oi."invoice_date"::date >= p_start_date)
              and (p_end_date is null or oi."invoice_date"::date <= p_end_date)
            group by sp.sales_rep_name
            order by revenue_myr desc
            limit 15
        ) x
    ),

    'productTypeData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                coalesce(product_type::text, 'Unspecified') as name,
                coalesce(sum(actual_revenue) filter (
                    where stage = 'WON'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ), 0) as won_revenue
            from base_leads
            where not is_cancelled
            group by coalesce(product_type::text, 'Unspecified')
            order by won_revenue desc
        ) x
    ),

    'sourceData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                lst.name,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_revenue
            from base_leads fl
            join lead_source_types lst on lst.id = fl.lead_source_type_id
            where not fl.is_cancelled
            group by lst.name
            order by won_revenue desc
        ) x
    ),

    'topClientsData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                c.name,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_revenue
            from base_leads fl
            join clients c on c.id = fl.client_id
            where not fl.is_cancelled
            group by c.name
            order by won_revenue desc
            limit 10
        ) x
    )

)
into result;

return result;

end;
$$;
