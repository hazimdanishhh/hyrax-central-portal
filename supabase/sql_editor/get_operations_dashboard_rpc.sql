create or replace function get_operations_dashboard(
    p_start_date date default null,
    p_end_date   date default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_caller_role text;
    v_caller_department text;
begin

-- 0. Authorization guard (2026-09) -- this RPC previously had none at all.
-- The frontend route (OperationsRoutes.jsx) already gates this page to
-- departments=["OPS","MGM"] roles=["manager"], but that's a UI convenience
-- only -- without a guard here, any authenticated caller who could invoke
-- this RPC directly (bypassing the frontend) would get real company-wide
-- Operations figures back, regardless of department/role, the moment the
-- underlying tables grant OPS/MGM anything (see
-- operations_department_access_fix.sql). Mirrors
-- get_finance_dashboard_rpc.sql's existing FIN/MGM manager guard.
select r.name, d.sub
  into v_caller_role, v_caller_department
from profiles p
join roles r on r.id = p.role_id
join departments d on d.id = p.department_id
where p.id = auth.uid();

if v_caller_role is null then
    raise exception 'Access denied';
end if;

if v_caller_role <> 'superadmin'
   and not (v_caller_role = 'manager' and v_caller_department in ('OPS', 'MGM')) then
    raise exception 'Access denied';
end if;

-- Operations & Fulfilment Reports (Tier 3).
-- Buildable entirely from the 11 already-extracted SAP tables -- no new
-- extraction needed. See hyrax-central-portal/docs/DEPARTMENT-DASHBOARD-BLUEPRINT.md §5.3.
--
-- "Open backlog" / "stock position" figures below are intentionally NOT
-- bounded by p_start_date/p_end_date -- they're point-in-time balances
-- (mirrors how Finance's Outstanding AR / Overdue Value are always "as of
-- today", not period flows). Fill-rate / on-time / cycle-time figures ARE
-- period-bound, scoped by the order's own order_date.

with base_orders as (
    select so.*
    from sap_sales_orders so
    where so.is_cancelled = 'N'
),

-- Order lines carrying their parent order's order_date, for period-scoping
-- fill-rate/undelivered stats without re-joining sap_sales_orders every time.
base_order_lines as (
    select
        rdr1.*,
        so."order_date"::date as parent_order_date
    from sap_sales_order_lines rdr1
    join base_orders so on so.doc_entry = rdr1.doc_entry
),

base_deliveries as (
    select d.*
    from sap_deliveries d
    where d.is_cancelled = 'N'
),

-- Deliveries matched back to their originating sales order (base_type = 17,
-- per the documented join reference in hyrax-data-platform/docs/DATA-DICTIONARY.md).
delivery_vs_order as (
    select distinct
        d.doc_entry as delivery_doc_entry,
        d."delivery_date"::date as actual_delivery_date,
        d."promised_delivery_date"::date as promised_delivery_date,
        so.doc_entry as so_doc_entry,
        so."delivery_date"::date as requested_delivery_date
    from base_deliveries d
    join sap_delivery_lines dl on dl.doc_entry = d.doc_entry
    join base_orders so on so.doc_entry = dl.base_entry and dl.base_type = 17
),

-- Full document chain (order -> delivery -> invoice) for cycle-time calc.
-- Line-level joins collapsed with DISTINCT to one row per document triple --
-- an approximation when a single order/delivery spans multiple invoices,
-- consistent in spirit with the sanitization approximations already used
-- in get_finance_dashboard (e.g. the GrosProfit outlier clamp).
full_chain as (
    select distinct
        so.doc_entry as so_doc_entry,
        so."order_date"::date as order_date,
        d.doc_entry as delivery_doc_entry,
        d."delivery_date"::date as delivery_date,
        i.doc_entry as invoice_doc_entry,
        i."invoice_date"::date as invoice_date
    from base_orders so
    join sap_delivery_lines dl on dl.base_entry = so.doc_entry and dl.base_type = 17
    join sap_deliveries d on d.doc_entry = dl.doc_entry and d.is_cancelled = 'N'
    left join sap_invoice_lines il on il.base_entry = d.doc_entry and il.base_type = 15
    left join sap_invoices i on i.doc_entry = il.doc_entry and i.is_cancelled = 'N'
),

kpi_totals as (
    select
        -- Point-in-time backlog (not period-bound)
        (select count(*) from base_orders where status_code = 'O') as open_order_count,
        (select coalesce(sum(total_amount_myr), 0) from base_orders where status_code = 'O') as open_order_value,
        (select coalesce(sum(open_qty), 0) from base_order_lines) as undelivered_units,

        -- Period-bound fulfilment quality
        (select coalesce(sum(delivered_qty), 0) from base_order_lines
          where (p_start_date is null or parent_order_date >= p_start_date)
            and (p_end_date is null or parent_order_date <= p_end_date)
        ) as total_delivered_qty,

        (select coalesce(sum(quantity), 0) from base_order_lines
          where (p_start_date is null or parent_order_date >= p_start_date)
            and (p_end_date is null or parent_order_date <= p_end_date)
        ) as total_ordered_qty,

        (select count(*) from delivery_vs_order
          where (p_start_date is null or actual_delivery_date >= p_start_date)
            and (p_end_date is null or actual_delivery_date <= p_end_date)
        ) as delivered_count,

        (select count(*) filter (where actual_delivery_date <= requested_delivery_date) from delivery_vs_order
          where (p_start_date is null or actual_delivery_date >= p_start_date)
            and (p_end_date is null or actual_delivery_date <= p_end_date)
        ) as on_time_vs_request_count,

        (select count(*) filter (where actual_delivery_date <= promised_delivery_date) from delivery_vs_order
          where (p_start_date is null or actual_delivery_date >= p_start_date)
            and (p_end_date is null or actual_delivery_date <= p_end_date)
        ) as on_time_vs_promise_count,

        -- NOTE: order_date/delivery_date/invoice_date are all cast to ::date
        -- in full_chain, so "date - date" already returns a plain integer
        -- day-count in Postgres (unlike "timestamp - timestamp", which
        -- returns an interval) -- no extract(epoch from ...)/86400 needed,
        -- and using it here throws (extract() has no integer overload).
        (select round(avg(delivery_date - order_date), 1)
           from full_chain
           where delivery_date is not null
             and (p_start_date is null or order_date >= p_start_date)
             and (p_end_date is null or order_date <= p_end_date)
        ) as avg_order_to_ship_days,

        (select round(avg(invoice_date - delivery_date), 1)
           from full_chain
           where invoice_date is not null and delivery_date is not null
             and (p_start_date is null or order_date >= p_start_date)
             and (p_end_date is null or order_date <= p_end_date)
        ) as avg_ship_to_invoice_days,

        (select round(avg(invoice_date - order_date), 1)
           from full_chain
           where invoice_date is not null
             and (p_start_date is null or order_date >= p_start_date)
             and (p_end_date is null or order_date <= p_end_date)
        ) as avg_order_to_invoice_days
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'openOrderCount', open_order_count,
            'openOrderValue', open_order_value,
            'undeliveredUnits', undelivered_units,
            'fillRatePct', case when total_ordered_qty > 0
                                then round((total_delivered_qty / total_ordered_qty) * 100, 1)
                                else 0 end,
            'onTimeVsRequestPct', case when delivered_count > 0
                                then round((on_time_vs_request_count::numeric / delivered_count) * 100, 1)
                                else 0 end,
            'onTimeVsPromisePct', case when delivered_count > 0
                                then round((on_time_vs_promise_count::numeric / delivered_count) * 100, 1)
                                else 0 end,
            'avgOrderToShipDays', coalesce(avg_order_to_ship_days, 0),
            'avgShipToInvoiceDays', coalesce(avg_ship_to_invoice_days, 0),
            'avgOrderToInvoiceDays', coalesce(avg_order_to_invoice_days, 0)
        )
        from kpi_totals
    ),

    -- Always "as of today" -- backlog age, not a period flow.
    'backlogAgingData', (
        select coalesce(json_agg(x order by x.bucket_order), '[]'::json)
        from (
            select
                case
                    when current_date - "order_date"::date <= 30 then '0-30 Days'
                    when current_date - "order_date"::date <= 60 then '31-60 Days'
                    when current_date - "order_date"::date <= 90 then '61-90 Days'
                    else '90+ Days'
                end as bucket,
                case
                    when current_date - "order_date"::date <= 30 then 1
                    when current_date - "order_date"::date <= 60 then 2
                    when current_date - "order_date"::date <= 90 then 3
                    else 4
                end as bucket_order,
                count(*) as order_count,
                sum(total_amount_myr) as open_value_myr
            from base_orders
            where status_code = 'O'
            group by 1, 2
        ) x
    ),

    'shipmentTrendData', (
        select coalesce(json_agg(x order by x.month), '[]'::json)
        from (
            select
                to_char(date_trunc('month', "delivery_date"::date), 'YYYY-MM') as month,
                count(distinct doc_entry) as delivery_count
            from base_deliveries
            where (p_start_date is null or "delivery_date"::date >= p_start_date)
              and (p_end_date is null or "delivery_date"::date <= p_end_date)
            group by 1
        ) x
    ),

    'topUndeliveredItemsData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                bol.item_code,
                coalesce(it.item_name, bol.item_code) as item_name,
                sum(bol.open_qty) as open_qty
            from base_order_lines bol
            left join sap_items it on it.item_code = bol.item_code
            where bol.open_qty > 0
            group by bol.item_code, coalesce(it.item_name, bol.item_code)
            order by open_qty desc
            limit 10
        ) x
    ),

    -- Aggregate (company-wide) stock position -- no per-warehouse breakdown
    -- possible until OITW is extracted (see blueprint §5.3, tagged C).
    'stockPositionData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                it.item_code,
                it.item_name,
                it.stock_on_hand,
                it.committed_stock,
                it.on_order,
                (it.stock_on_hand - it.committed_stock) as available_qty,
                (it.committed_stock > it.stock_on_hand) as is_over_committed
            from sap_items it
            where it.is_active = 'Y'
              and (it.stock_on_hand > 0 or it.committed_stock > 0)
            order by is_over_committed desc, it.stock_on_hand asc
            limit 10
        ) x
    )

)
into result;

return result;

end;
$$;
