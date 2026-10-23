-- ############################################################################
-- get_sales_orders -- Sales Reports, ORDERS tab (bookings and the order book)
-- (src/pages/user/sales/reports/tabs/OrdersTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md.
--
-- For meetings: how much business was booked, how much of it is still
-- waiting to be delivered or billed, and is billing keeping up with
-- bookings. The order list itself (what to chase today) stays on the Orders
-- page; the order book here uses that page's own rules
-- (sales_order_book_facts).
--
--   kpis.booked ...     sales_totals (Orders Booked, same as on Summary)
--   kpis.bookToBill     booked / invoiced in the same period: above 1 the
--                       order book is growing, below 1 it is being worked
--                       down. null when nothing was invoiced
--   kpis.orderBook*     sales_order_book_totals -- ACTIONABLE: the whole
--                       current backlog unless a period is picked, then
--                       orders placed in that period
--   kpis.openBacklogMonths  open backlog / average monthly invoiced revenue
--                       over the last 3 COMPLETE months (a recent run rate,
--                       independent of the period picked): how many months
--                       of invoicing the backlog already represents
--   ordersVsInvoiced    monthly booked vs invoiced, trend window
--   topCustomers        top 10 customers by orders booked in the period
--
-- Run after sales_metric_facts_views.sql and sales_metric_functions.sql.
-- ############################################################################

create or replace function public.get_sales_orders(
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
    ob  record;
    ly  record;
    lyt record;
    rr  record;
begin
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    select * into cur from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.prev_start, per.prev_end);
    select * into ob from public.sales_order_book_totals(sc.sales_rep_code, per.has_period, per.start_date, per.end_date);
    select * into ly from public.report_last_year(p_start_date, p_end_date);
    select * into lyt from public.sales_totals(sc.sales_rep_code, sc.owner_id, ly.ly_start, ly.ly_end);
    -- Recent run rate: the 3 complete months before this one.
    select * into rr from public.sales_totals(
        sc.sales_rep_code, sc.owner_id,
        (date_trunc('month', current_date) - interval '3 months')::date,
        (date_trunc('month', current_date) - interval '1 day')::date);

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, sc.sales_rep_code, sc.mapping_missing),

        'kpis', json_build_object(
            'booked', cur.booked,
            'prevBooked', prv.booked,
            'orderCount', cur.order_count,
            'orderingCustomers', cur.ordering_customers,
            'avgOrderValue', case when cur.order_count > 0 then round(cur.booked / cur.order_count, 2) end,
            'invoiced', cur.invoiced,
            'bookToBill', case when cur.invoiced > 0 then round(cur.booked / cur.invoiced, 2) end,
            'prevBookToBill', case when prv.invoiced > 0 then round(prv.booked / prv.invoiced, 2) end,
            'orderBookValue', ob.open_value,
            'orderBookOrders', ob.open_orders,
            'overdueValue', ob.overdue_value,
            'overdueOrders', ob.overdue_orders,
            'unbilledValue', ob.unbilled_value,
            'unbilledOrders', ob.unbilled_orders,
            'lastYearBooked', lyt.booked,
            'recentMonthlyInvoiced', round(rr.invoiced / 3, 2),
            'openBacklogMonths',
                case when rr.invoiced > 0 then round(ob.open_value / (rr.invoiced / 3), 1) end
        ),

        'ordersVsInvoiced', (
            select coalesce(json_agg(json_build_object(
                'period', to_char(s.month_start, 'YYYY-MM'),
                'isPartial', s.is_partial,
                'inPeriod', s.in_period,
                'booked', s.booked,
                'invoiced', s.invoiced
            ) order by s.month_start), '[]'::json)
            from public.sales_monthly_series(
                sc.sales_rep_code, sc.owner_id,
                per.trend_start, per.trend_end,
                per.start_date, per.end_date) s
        ),

        'topCustomers', (
            select coalesce(json_agg(json_build_object(
                'customerCode', x.customer_code,
                'name', coalesce(c.customer_name, x.customer_code),
                'value', x.booked
            ) order by x.booked desc), '[]'::json)
            from (
                select customer_code, sum(booked_myr) as booked
                from public.sales_order_facts
                where order_date between per.start_date and per.end_date
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by customer_code
                order by booked desc, customer_code
                limit 10
            ) x
            left join public.sap_customers c on c.customer_code = x.customer_code
        )
    );
end;
$$;

revoke execute on function public.get_sales_orders(date, date, uuid) from public, anon;
grant execute on function public.get_sales_orders(date, date, uuid) to authenticated;
