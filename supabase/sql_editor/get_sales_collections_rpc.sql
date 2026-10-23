-- ############################################################################
-- get_sales_collections -- Sales Reports, COLLECTIONS tab
-- (src/pages/user/sales/reports/tabs/CollectionsTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md; rules: DASHBOARD-CONVENTIONS §8.
--
-- For meetings: is the cash coming in, how much is owed, and how late is it.
--
--   kpis.collected ...      sales_totals (Payments Collected's one definition)
--                           for the period, comparison window, last year
--   kpis.outstanding ...    sales_receivable_totals -- TODAY (R3), whatever
--   kpis.overdue* / critical*   period is picked, on FINANCE's open-invoice
--   kpis.dso                    rule, so it matches Finance -> Invoices for
--                           the same rep. dso is Finance's formula (ar_dso)
--                           over the trailing 90 days
--   invoicedVsCollected     monthly, trend window
--   overdueByAge            today's Outstanding by days past due: Not Yet Due,
--                           1-30, 31-60, 61-90, 90+ (adds up to outstanding)
--   topOverdue              top 10 customers by overdue balance, today
--   topPayers               top 10 customers by cash collected in the period
--
-- Removed 2026-10-23: collectionRatePct (this period's cash / this period's
-- invoices -- customers on 30-60 day terms pay EARLIER invoices, so it was
-- not a standard measure; aging + overdue + DSO replace it), and
-- topOutstanding (replaced by topOverdue: what is late, not just owed).
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
    ar  record;
begin
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    select * into cur from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.prev_start, per.prev_end);
    select * into ly from public.report_last_year(p_start_date, p_end_date);
    select * into lyt from public.sales_totals(sc.sales_rep_code, sc.owner_id, ly.ly_start, ly.ly_end);
    select * into ar from public.sales_receivable_totals(sc.sales_rep_code, sc.owner_id);

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, sc.sales_rep_code, sc.mapping_missing),

        'kpis', json_build_object(
            'collected', cur.collected,
            'prevCollected', prv.collected,
            'lastYearCollected', lyt.collected,
            'paymentCount', cur.payment_count,
            'payingCustomers', cur.paying_customers,
            'outstanding', ar.outstanding,
            'outstandingInvoices', ar.invoices,
            'outstandingCustomers', ar.customers,
            'overdueValue', ar.overdue_value,
            'overdueCount', ar.overdue_count,
            'overduePct', case when ar.outstanding > 0 then round(ar.overdue_value / ar.outstanding * 100, 1) end,
            'criticalValue', ar.critical_value,
            'criticalCount', ar.critical_count,
            'dso', ar.dso
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

        'overdueByAge', json_build_array(
            json_build_object('name', 'Not Yet Due', 'value', ar.not_due),
            json_build_object('name', '1–30 days', 'value', ar.d1_30),
            json_build_object('name', '31–60 days', 'value', ar.d31_60),
            json_build_object('name', '61–90 days', 'value', ar.d61_90),
            json_build_object('name', '90+ days', 'value', ar.d90_plus)
        ),

        'topOverdue', (
            select coalesce(json_agg(json_build_object(
                'customerCode', x.customer_code,
                'name', x.name,
                'value', x.overdue,
                'critical', x.critical
            ) order by x.overdue desc), '[]'::json)
            from (
                select customer_code,
                       max(customer_name) as name,
                       sum(outstanding_myr) as overdue,
                       coalesce(sum(outstanding_myr) filter (where days_past_due > 90), 0) as critical
                from public.sales_receivable_facts
                where days_past_due > 0
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by customer_code
                order by overdue desc, customer_code
                limit 10
            ) x
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
        )
    );
end;
$$;

revoke execute on function public.get_sales_collections(date, date, uuid) from public, anon;
grant execute on function public.get_sales_collections(date, date, uuid) to authenticated;
