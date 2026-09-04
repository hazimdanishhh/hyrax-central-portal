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
create or replace function public.get_sales_orders_overview()
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_orders as (
        select *
        from public.sap_sales_orders
        where is_cancelled = 'N'
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
        ), 0)
    )
    into result
    from base_orders;

    return result;
end;
$$;
