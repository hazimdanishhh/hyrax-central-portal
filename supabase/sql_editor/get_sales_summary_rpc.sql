-- ############################################################################
-- get_sales_summary -- Sales Reports, SUMMARY tab
-- (src/pages/user/sales/reports/tabs/SummaryTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md §3-§4.
--
-- For weekly / monthly meetings: are we on track, where is the gap, are we
-- growing. Every figure comes from the shared metric layer
-- (sales_metric_functions.sql) -- this function adds no definitions of its
-- own, so a number here is the same number on every other tab.
--
--   meta              sales_report_meta (period, comparison, trend windows)
--   kpis              sales_totals for the period AND the comparison window
--                     (same call, so a delta can't compare unlike things)
--   revenueVsBudget   monthly invoiced vs budget over the trend window
--   budgetBridge      per-rep invoiced vs budget (sales_rep_totals) -- the
--                     page turns it into the gap bridge
--   orderToCashYoY    won / booked / invoiced / collected per fiscal year,
--                     last 10 FYs, summed from the same monthly series
--
-- The FY Outlook tile is NOT here: it reads get_sales_projections (a
-- separate request on purpose -- a forecast outage must not blank Summary).
--
-- Run after sales_metric_facts_views.sql and sales_metric_functions.sql.
-- ############################################################################

create or replace function public.get_sales_summary(
    p_start_date date default null,
    p_end_date   date default null,
    p_owner_id   uuid default null
)
returns json
language plpgsql
stable
security invoker
as $$
declare
    sc  record;
    per record;
    cur record;
    prv record;
    v_fy_now date := public.fiscal_year_start(current_date);
begin
    -- Access guard + salesperson (raises 'Access denied').
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    select * into cur from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.prev_start, per.prev_end);

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, sc.sales_rep_code, sc.mapping_missing),

        'kpis', json_build_object(
            'invoiced', cur.invoiced,
            'prevInvoiced', prv.invoiced,
            'invoiceCount', cur.invoice_count,
            'budget', cur.budget,
            -- null (not 0) with no budget: "—", not "0% Critical"
            'budgetAttainmentPct',
                case when cur.budget > 0 then round(cur.invoiced / cur.budget * 100) end,
            'booked', cur.booked,
            'prevBooked', prv.booked,
            'orderCount', cur.order_count,
            'collected', cur.collected,
            'prevCollected', prv.collected,
            'paymentCount', cur.payment_count,
            'won', cur.won,
            'prevWon', prv.won,
            'wonCount', cur.won_count,
            'target', cur.target,
            'targetAttainmentPct',
                case when cur.target > 0 then round(cur.won / cur.target * 100) end
        ),

        'revenueVsBudget', (
            select coalesce(json_agg(json_build_object(
                'period', to_char(s.month_start, 'YYYY-MM'),
                'isPartial', s.is_partial,
                'inPeriod', s.in_period,
                'invoiced', s.invoiced,
                'budget', s.budget
            ) order by s.month_start), '[]'::json)
            from public.sales_monthly_series(
                sc.sales_rep_code, sc.owner_id,
                per.trend_start, per.trend_end,
                per.start_date, per.end_date) s
        ),

        'budgetBridge', (
            select coalesce(json_agg(json_build_object(
                'salesRepCode', r.sales_rep_code,
                'name', coalesce(r.sales_rep_name, 'Unassigned'),
                'invoiced', r.invoiced,
                'budget', r.budget
            ) order by r.invoiced desc), '[]'::json)
            from public.sales_rep_totals(sc.sales_rep_code, per.start_date, per.end_date) r
        ),

        'orderToCashYoY', (
            select coalesce(json_agg(json_build_object(
                'name', extract(year from y.fy)::int || '-' || (extract(year from y.fy)::int + 1),
                'isPartial', y.fy = v_fy_now,
                'inPeriod', y.fy between public.fiscal_year_start(per.start_date)
                                     and public.fiscal_year_start(per.end_date),
                'won', y.won,
                'booked', y.booked,
                'invoiced', y.invoiced,
                'collected', y.collected
            ) order by y.fy), '[]'::json)
            from (
                select
                    public.fiscal_year_start(s.month_start) as fy,
                    coalesce(sum(s.won), 0) as won,
                    coalesce(sum(s.booked), 0) as booked,
                    coalesce(sum(s.invoiced), 0) as invoiced,
                    coalesce(sum(s.collected), 0) as collected
                from public.sales_monthly_series(
                    sc.sales_rep_code, sc.owner_id,
                    (v_fy_now - interval '9 years')::date,
                    (v_fy_now + interval '1 year' - interval '1 day')::date,
                    per.start_date, per.end_date) s
                group by 1
            ) y
        )
    );
end;
$$;

revoke execute on function public.get_sales_summary(date, date, uuid) from public, anon;
grant execute on function public.get_sales_summary(date, date, uuid) to authenticated;
