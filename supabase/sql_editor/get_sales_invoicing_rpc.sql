-- ############################################################################
-- get_sales_invoicing -- Sales Reports, INVOICING tab (billings)
-- (src/pages/user/sales/reports/tabs/InvoicingTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md §3-§4.
--
-- Orders (bookings, order book) have their own tab: get_sales_orders.
-- Headline totals come from sales_totals (the same call Summary makes), the
-- monthly chart from sales_monthly_series. The breakdowns below read the
-- Layer 1 fact views directly, filtered by the same period and salesperson
-- -- they are groupings of the same rows, never a different definition.
--
--   kpis.invoiced / budget ...   sales_totals, period + comparison window
--   kpis.customer*               top-5 customers' share of Invoiced Revenue
--   kpis.product* / topGroup     shares of PRODUCT SALES (BEFORE TAX): the
--                                numerator and denominator are both line
--                                totals, so the share is never a mix of
--                                before-tax lines over an after-tax total
--   kpis.grossProfit / grossMarginPct / gpCoveragePct
--                                sales_gross_margin (2026-10-23): margin on
--                                invoices whose GP is known, before tax, with
--                                the share of revenue that covers. Shown only
--                                once the data check passes (plan §4)
--   invoicedVsBudget             monthly invoiced vs budget, trend window
--   topCustomers                 top 10 by invoiced. (Until 2026-10-23 it
--                                also showed what they paid in the same
--                                period -- this period's cash against this
--                                period's invoices, the timing mismatch that
--                                retired Collection Rate; removed with it.)
--   topProducts / productGroups  product sales (before tax)
--   exportLocal                  invoiced by customer classification
--
-- Run after sales_metric_facts_views.sql and sales_metric_functions.sql.
-- ############################################################################

create or replace function public.get_sales_invoicing(
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
    v_cust record;
    v_prod record;
    v_group record;
    gm  record;
    pgm record;
    lgm record;
begin
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    select * into cur from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.prev_start, per.prev_end);
    select * into ly from public.report_last_year(p_start_date, p_end_date);
    select * into lyt from public.sales_totals(sc.sales_rep_code, sc.owner_id, ly.ly_start, ly.ly_end);
    select * into gm  from public.sales_gross_margin(sc.sales_rep_code, per.start_date, per.end_date);
    select * into pgm from public.sales_gross_margin(sc.sales_rep_code, per.prev_start, per.prev_end);
    select * into lgm from public.sales_gross_margin(sc.sales_rep_code, ly.ly_start, ly.ly_end);

    -- Customer concentration: top 5 customers' share of invoiced revenue.
    with by_customer as (
        select customer_code, max(customer_name) as name, sum(invoiced_myr) as invoiced
        from public.sales_invoice_facts
        where invoice_date between per.start_date and per.end_date
          and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
        group by customer_code
    ),
    ranked as (
        select *, row_number() over (order by invoiced desc, customer_code) as rn
        from by_customer
    )
    select
        sum(invoiced) filter (where rn <= 5) as top5,
        sum(invoiced) as total,
        max(name) filter (where rn = 1) as top_name,
        max(invoiced) filter (where rn = 1) as top_value
    into v_cust
    from ranked;

    -- Product concentration, on product sales (before tax) throughout.
    with by_item as (
        select item_code, max(item_name) as name, sum(line_before_tax_myr) as sales
        from public.sales_invoice_line_facts
        where invoice_date between per.start_date and per.end_date
          and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
        group by item_code
    ),
    ranked as (
        select *, row_number() over (order by sales desc, item_code) as rn
        from by_item
    )
    select
        sum(sales) filter (where rn <= 5) as top5,
        sum(sales) as total,
        max(name) filter (where rn = 1) as top_name,
        max(sales) filter (where rn = 1) as top_value
    into v_prod
    from ranked;

    select item_group_name as name, sum(line_before_tax_myr) as sales
    into v_group
    from public.sales_invoice_line_facts
    where invoice_date between per.start_date and per.end_date
      and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
    group by item_group_name
    order by 2 desc, 1
    limit 1;

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, sc.sales_rep_code, sc.mapping_missing),

        'kpis', json_build_object(
            'invoiced', cur.invoiced,
            'prevInvoiced', prv.invoiced,
            'lastYearInvoiced', lyt.invoiced,
            'invoiceCount', cur.invoice_count,
            'avgInvoiceValue', case when cur.invoice_count > 0 then round(cur.invoiced / cur.invoice_count, 2) end,
            'budget', cur.budget,
            'budgetAttainmentPct',
                case when cur.budget > 0 then round(cur.invoiced / cur.budget * 100) end,
            'customerTop5Pct', case when v_cust.total > 0 then round(v_cust.top5 / v_cust.total * 100, 1) end,
            'topCustomerName', v_cust.top_name,
            'topCustomerPct', case when v_cust.total > 0 then round(v_cust.top_value / v_cust.total * 100, 1) end,
            'productSales', coalesce(v_prod.total, 0),
            'productTop5Pct', case when v_prod.total > 0 then round(v_prod.top5 / v_prod.total * 100, 1) end,
            'topProductName', v_prod.top_name,
            'topProductPct', case when v_prod.total > 0 then round(v_prod.top_value / v_prod.total * 100, 1) end,
            'topGroupName', v_group.name,
            'topGroupPct', case when v_prod.total > 0 then round(v_group.sales / v_prod.total * 100, 1) end,
            'grossProfit', gm.gross_profit,
            'grossMarginPct', gm.margin_pct,
            'prevGrossMarginPct', pgm.margin_pct,
            'lastYearGrossMarginPct', lgm.margin_pct,
            'gpCoveragePct', gm.coverage_pct
        ),

        'invoicedVsBudget', (
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

        -- Top 10 customers by invoiced revenue in the period.
        'topCustomers', (
            select coalesce(json_agg(json_build_object(
                'customerCode', t.customer_code,
                'name', t.name,
                'invoiced', t.invoiced
            ) order by t.invoiced desc), '[]'::json)
            from (
                select customer_code, max(customer_name) as name, sum(invoiced_myr) as invoiced
                from public.sales_invoice_facts
                where invoice_date between per.start_date and per.end_date
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by customer_code
                order by invoiced desc, customer_code
                limit 10
            ) t
        ),

        'topProducts', (
            select coalesce(json_agg(json_build_object(
                'itemCode', x.item_code,
                'name', x.name,
                'quantity', x.quantity,
                'sales', x.sales
            ) order by x.sales desc), '[]'::json)
            from (
                select item_code, max(item_name) as name, sum(quantity) as quantity,
                       sum(line_before_tax_myr) as sales
                from public.sales_invoice_line_facts
                where invoice_date between per.start_date and per.end_date
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by item_code
                order by sales desc, item_code
                limit 10
            ) x
        ),

        'productGroups', (
            select coalesce(json_agg(json_build_object(
                'name', x.item_group_name,
                'sales', x.sales
            ) order by x.sales desc), '[]'::json)
            from (
                select item_group_name, sum(line_before_tax_myr) as sales
                from public.sales_invoice_line_facts
                where invoice_date between per.start_date and per.end_date
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by item_group_name
            ) x
        ),

        'exportLocal', (
            select coalesce(json_agg(json_build_object(
                'name', x.classification,
                'value', x.invoiced
            ) order by x.invoiced desc), '[]'::json)
            from (
                select coalesce(local_export_flag, 'Unspecified') as classification,
                       sum(invoiced_myr) as invoiced
                from public.sales_invoice_facts
                where invoice_date between per.start_date and per.end_date
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by 1
            ) x
        )
    );
end;
$$;

revoke execute on function public.get_sales_invoicing(date, date, uuid) from public, anon;
grant execute on function public.get_sales_invoicing(date, date, uuid) to authenticated;
