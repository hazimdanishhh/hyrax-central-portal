-- ############################################################################
-- get_sales_collections -- Sales Reports, COLLECTIONS tab
-- (src/pages/user/sales/reports/tabs/CollectionsTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md §3-§4.
--
--   kpis.collected ...      sales_totals (Payments Collected's one definition)
--   kpis.outstanding ...    open receivables -- ACTIONABLE (DASHBOARD-
--                           CONVENTIONS §4b): the true current backlog when no
--                           period is picked; invoices raised in the period
--                           once one is
--   kpis.collectionRatePct  collected / invoiced in the SAME period (decision
--                           D3: kept, with its caveat -- customers on 30-60
--                           day terms pay later invoices, so a healthy month
--                           can sit below 70%). null when nothing was invoiced
--   invoicedVsCollected     monthly, trend window
--   topPayers               top 10 customers by cash collected in the period
--   topOutstanding          top 10 customers by open balance (ACTIONABLE)
--
-- Run after sales_metric_facts_views.sql and sales_metric_functions.sql.
-- ############################################################################

create or replace function public.get_sales_collections(
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
    v_ar record;
begin
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    select * into cur from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.prev_start, per.prev_end);
    select * into ly from public.report_last_year(p_start_date, p_end_date);
    select * into lyt from public.sales_totals(sc.sales_rep_code, sc.owner_id, ly.ly_start, ly.ly_end);

    select
        coalesce(sum(outstanding_myr), 0) as outstanding,
        count(*) as invoices,
        count(distinct customer_code) as customers
    into v_ar
    from public.sales_receivable_facts
    where (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
      and (not per.has_period or invoice_date between per.start_date and per.end_date);

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, sc.sales_rep_code, sc.mapping_missing),

        'kpis', json_build_object(
            'collected', cur.collected,
            'prevCollected', prv.collected,
            'lastYearCollected', lyt.collected,
            'paymentCount', cur.payment_count,
            'payingCustomers', cur.paying_customers,
            'invoiced', cur.invoiced,
            'collectionRatePct',
                case when cur.invoiced > 0 then round(cur.collected / cur.invoiced * 100, 1) end,
            'outstanding', v_ar.outstanding,
            'outstandingInvoices', v_ar.invoices,
            'outstandingCustomers', v_ar.customers
        ),

        'invoicedVsCollected', (
            select coalesce(json_agg(json_build_object(
                'period', to_char(s.month_start, 'YYYY-MM'),
                'isPartial', s.is_partial,
                'inPeriod', s.in_period,
                'invoiced', s.invoiced,
                'collected', s.collected
            ) order by s.month_start), '[]'::json)
            from public.sales_monthly_series(
                sc.sales_rep_code, sc.owner_id,
                per.trend_start, per.trend_end,
                per.start_date, per.end_date) s
        ),

        'topPayers', (
            select coalesce(json_agg(json_build_object(
                'customerCode', x.customer_code,
                'name', x.name,
                'value', x.collected
            ) order by x.collected desc), '[]'::json)
            from (
                select customer_code, max(customer_name) as name, sum(applied_myr) as collected
                from public.sales_collection_facts
                where payment_date between per.start_date and per.end_date
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by customer_code
                order by collected desc, customer_code
                limit 10
            ) x
        ),

        'topOutstanding', (
            select coalesce(json_agg(json_build_object(
                'customerCode', x.customer_code,
                'name', x.name,
                'value', x.outstanding
            ) order by x.outstanding desc), '[]'::json)
            from (
                select customer_code, max(customer_name) as name, sum(outstanding_myr) as outstanding
                from public.sales_receivable_facts
                where (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                  and (not per.has_period or invoice_date between per.start_date and per.end_date)
                group by customer_code
                order by outstanding desc, customer_code
                limit 10
            ) x
        )
    );
end;
$$;

revoke execute on function public.get_sales_collections(date, date, uuid) from public, anon;
grant execute on function public.get_sales_collections(date, date, uuid) to authenticated;
