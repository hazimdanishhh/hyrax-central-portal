-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Sales Orders list page's OverviewCards -- plain
-- function (NOT security definer), so it runs with the caller's own
-- row-security context: sap_sales_orders' existing per-department RLS
-- policies (Sales/MGM/Operations) already scope every figure below to
-- whatever this caller could already see via fetchSalesOrders(), same as
-- get_projects_overview's own reasoning. delivery_date (SAP's DocDueDate) is
-- the only due-date-shaped field on this table -- there's no separate
-- "actual delivery date" column here (that lives on sap_deliveries) -- so it
-- plays the same role due_date plays for invoices/bills, matching
-- get_operations_dashboard_rpc.sql's own backlog-aging bucket, which ages
-- off this same column. Due Soon window is 7 days.
--
-- Filter-aware (added 2026-09, matching fetchSalesOrders()'s own filter set
-- so this strip always summarizes exactly the rows the list would show for
-- the same filters): every param below is null-guarded independently, per
-- DASHBOARD-CONVENTIONS.md's date-range rule. p_is_cancelled defaults to
-- excluding cancelled docs ('N') when not supplied, matching the previous
-- hardcoded behavior. p_start_date/p_end_date scope order_date (this page's
-- own period filter), not delivery_date -- matches fetchSalesOrders()'s own
-- startDate/endDate branches. Deliberately NOT parameterized: overdueOnly/
-- dueSoonOnly -- those toggles are what this page's own KPI tiles set on the
-- list when clicked, so feeding them back in would be circular (overdueOnly
-- would force dueSoonCount to always be 0). Don't add them here.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- Postgres identifies a
-- function by name + parameter *types*, so the previous zero-argument
-- get_sales_orders_overview() is a genuinely different signature and would
-- otherwise keep existing as a second, separate overload after this file is
-- re-run, silently coexisting alongside the parameterized version below. The
-- explicit drop guarantees only one overload survives -- run it first.
drop function if exists public.get_sales_orders_overview();

create or replace function public.get_sales_orders_overview(
    p_customer_code text default null,
    p_sales_rep_code bigint default null,
    p_status_code text default null,
    p_is_cancelled text default null,
    p_start_date date default null,
    p_end_date date default null,
    p_search text default null
)
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_orders as (
        select *
        from public.sap_sales_orders
        where (
                case when p_is_cancelled is null then is_cancelled = 'N'
                     else is_cancelled = p_is_cancelled
                end
              )
          and (p_customer_code is null or customer_code = p_customer_code)
          and (p_sales_rep_code is null or sales_rep_code = p_sales_rep_code)
          and (p_status_code is null or status_code = p_status_code)
          and (p_start_date is null or order_date::date >= p_start_date)
          and (p_end_date is null or order_date::date <= p_end_date)
          and (
                p_search is null
                or customer_name ilike '%' || p_search || '%'
                or customer_ref ilike '%' || p_search || '%'
                or (p_search ~ '^\d+$' and so_number::text = p_search)
              )
    )
    select json_build_object(
        'openCount', count(*) filter (where status_code = 'O'),
        'openValue', coalesce(sum(total_amount_myr) filter (where status_code = 'O'), 0),

        'dueSoonCount', count(*) filter (
            where status_code = 'O'
              and delivery_date::date >= current_date
              and delivery_date::date <= current_date + 7
        ),
        'dueSoonValue', coalesce(sum(total_amount_myr) filter (
            where status_code = 'O'
              and delivery_date::date >= current_date
              and delivery_date::date <= current_date + 7
        ), 0),

        'overdueCount', count(*) filter (
            where status_code = 'O' and delivery_date::date < current_date
        ),
        'overdueValue', coalesce(sum(total_amount_myr) filter (
            where status_code = 'O' and delivery_date::date < current_date
        ), 0),

        -- Added 2026-09: activity/volume pulse, distinct from the three
        -- backlog-urgency figures above -- counts ALL orders placed in the
        -- trailing 7 days regardless of status_code (a "new this week"
        -- figure describes inflow, not what's still open).
        'newThisWeekCount', count(*) filter (
            where order_date::date >= current_date - 7
        ),
        'newThisWeekValue', coalesce(sum(total_amount_myr) filter (
            where order_date::date >= current_date - 7
        ), 0)
    )
    into result
    from base_orders;

    return result;
end;
$$;
