-- ############################################################################
-- get_sales_summary -- Sales Reports, SUMMARY tab
-- (src/pages/user/sales/reports/tabs/SummaryTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md; rules: DASHBOARD-CONVENTIONS §8.
--
-- The meeting's opening page (R1, answer first): how did we do this period,
-- where does the year stand, why, and what is open right now. Every figure
-- comes from the shared metric layer (sales_metric_functions.sql) -- this
-- function adds no definitions of its own, so a number here is the same
-- number on every other tab.
--
--   meta              sales_report_meta (period, comparison, trend windows)
--   kpis              sales_totals for the period, the comparison window and
--                     the same period last year (report_last_year) -- the
--                     same call each time, so no delta compares unlike things
--   fyProgress        sales_fy_progress: Invoiced Revenue FY to date vs the
--                     budget to date, and the Monthly Invoicing Needed for
--                     the rest of the FY
--   fyCumulative      (2026-10-23) running FY-to-date Invoiced Revenue and
--                     Revenue Budget per month of that fiscal year, from
--                     sales_monthly_series -- the line chart under Fiscal
--                     Year Progress. Its last actual point equals
--                     fyProgress.fytdInvoiced for a period ending today.
--                     The monthly (non-cumulative) chart is on Invoicing.
--   budgetBridge      per-rep invoiced vs budget (sales_rep_totals) -- the
--                     page turns it into the gap bridge (waterfall)
--   openPosition      (2026-10-23) TODAY's open balances, each the same
--                     function call its own tab makes: Active Pipeline +
--                     Pipeline Coverage (Pipeline), Open Backlog (Orders),
--                     Outstanding / Overdue (Collections)
--   orderToCashYoY    won / booked / invoiced / collected per fiscal year,
--                     last 10 FYs, summed from the same monthly series.
--                     won is null for fiscal years before the first CRM lead
--                     was created: "no CRM yet" is not "won nothing"
--
-- The projection tiles are NOT here: they read get_sales_projections (a
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
    ly  record;
    lyt record;
    fyp record;
    pip record;
    cov record;
    ob  record;
    ar  record;
    v_fy_now date := public.fiscal_year_start(current_date);
    v_first_crm_fy date;
begin
    -- Access guard + salesperson (raises 'Access denied').
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    select * into cur from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.prev_start, per.prev_end);
    select * into ly from public.report_last_year(p_start_date, p_end_date);
    select * into lyt from public.sales_totals(sc.sales_rep_code, sc.owner_id, ly.ly_start, ly.ly_end);
    select * into fyp from public.sales_fy_progress(sc.sales_rep_code, sc.owner_id, p_start_date, p_end_date);

    -- Open position, TODAY (never narrowed by the period).
    select * into pip from public.sales_pipeline_totals(sc.owner_id, per.start_date, per.end_date);
    select * into cov from public.sales_pipeline_coverage(sc.owner_id);
    select * into ob  from public.sales_order_book_totals(sc.sales_rep_code);
    select * into ar  from public.sales_receivable_totals(sc.sales_rep_code, sc.owner_id);

    -- The fiscal year the CRM started in (company-wide: it is when the
    -- system came into use, not when one salesperson's first lead was).
    select public.fiscal_year_start(min(created_on)) into v_first_crm_fy
    from public.sales_lead_facts;

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
                case when cur.target > 0 then round(cur.won / cur.target * 100) end,
            'lastYearWon', lyt.won,
            'lastYearBooked', lyt.booked,
            'lastYearInvoiced', lyt.invoiced,
            'lastYearCollected', lyt.collected
        ),

        -- Fiscal Year Progress. monthlyNeeded = what is still needed to reach
        -- the FY Revenue Budget, spread over the months left (part-months by
        -- days, months_spanned); null with no FY budget or no months left.
        'fyProgress', json_build_object(
            'fyStart', fyp.fy_start,
            'fyEnd', fyp.fy_end,
            'asOf', fyp.as_of,
            'fytdInvoiced', fyp.fytd_invoiced,
            'fytdBudget', fyp.fytd_budget,
            'fytdAttainmentPct',
                case when fyp.fytd_budget > 0 then round(fyp.fytd_invoiced / fyp.fytd_budget * 100) end,
            'fyBudget', fyp.fy_budget,
            'budgetRemaining',
                case when fyp.fy_budget is not null then greatest(fyp.fy_budget - fyp.fytd_invoiced, 0) end,
            'monthsElapsed', round(fyp.months_elapsed, 2),
            'monthsLeft', round(fyp.months_left, 2),
            'monthlyAverage',
                case when fyp.months_elapsed > 0 then round(fyp.fytd_invoiced / fyp.months_elapsed, 2) end,
            'monthlyNeeded',
                case when fyp.fy_budget is not null and fyp.months_left > 0
                     then round(greatest(fyp.fy_budget - fyp.fytd_invoiced, 0) / fyp.months_left, 2) end
        ),

        -- Running totals over the fiscal year of fyProgress. Actual stops
        -- after the current month (null, like the series); budget runs to
        -- the FY end, null until the first month with a budget row.
        'fyCumulative', (
            select coalesce(json_agg(json_build_object(
                'period', to_char(c.month_start, 'YYYY-MM'),
                'isPartial', c.is_partial,
                'inPeriod', c.in_period,
                'invoiced', c.invoiced_cum,
                'budget', c.budget_cum
            ) order by c.month_start), '[]'::json)
            from (
                select
                    s.month_start,
                    s.is_partial,
                    s.in_period,
                    case when s.invoiced is not null
                         then sum(s.invoiced) over (order by s.month_start) end as invoiced_cum,
                    case when count(s.budget) over (order by s.month_start) > 0
                         then sum(s.budget) over (order by s.month_start) end as budget_cum
                from public.sales_monthly_series(
                    sc.sales_rep_code, sc.owner_id,
                    fyp.fy_start, fyp.fy_end,
                    per.start_date, per.end_date) s
            ) c
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

        'openPosition', json_build_object(
            'activePipeline', pip.open_value,
            'weightedPipeline', pip.weighted_value,
            'activeLeads', pip.open_count,
            'pipelineCoverage', cov.coverage,
            'targetRemaining', cov.target_remaining,
            'openBacklog', ob.open_value,
            'openBacklogOrders', ob.open_orders,
            'openBacklogMonths', ob.backlog_months,
            'outstanding', ar.outstanding,
            'outstandingInvoices', ar.invoices,
            'overdue', ar.overdue_value,
            'criticallyOverdue', ar.critical_value
        ),

        'orderToCashYoY', (
            select coalesce(json_agg(json_build_object(
                'name', extract(year from y.fy)::int || '-' || (extract(year from y.fy)::int + 1),
                'isPartial', y.fy = v_fy_now,
                'inPeriod', y.fy between public.fiscal_year_start(per.start_date)
                                     and public.fiscal_year_start(per.end_date),
                'won', case when v_first_crm_fy is not null and y.fy >= v_first_crm_fy then y.won end,
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
