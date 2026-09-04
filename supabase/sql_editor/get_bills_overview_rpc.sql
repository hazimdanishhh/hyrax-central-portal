-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Bills list page's OverviewCards -- AP mirror of
-- get_invoices_overview_rpc.sql. Plain function (NOT security definer), so
-- it runs with the caller's own row-security context: sap_vendor_bills'
-- existing "Finance Department VIEW" RLS policy already scopes every figure
-- below to whatever this caller could already see via fetchBills(). Formula
-- copied verbatim from get_finance_dashboard_rpc.sql's own AP KPIs. Due Soon
-- window is 7 days.
create or replace function public.get_bills_overview()
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_bills as (
        select *
        from public.sap_vendor_bills
        where is_cancelled = 'N'
    )
    select json_build_object(
        'outstandingCount', count(*) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
        ),
        'outstandingValue', coalesce(sum(total_amount_myr - paid_to_date) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
        ), 0),

        'dueSoonCount', count(*) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
              and due_date::date >= current_date
              and due_date::date <= current_date + 7
        ),
        'dueSoonValue', coalesce(sum(total_amount_myr - paid_to_date) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
              and due_date::date >= current_date
              and due_date::date <= current_date + 7
        ), 0),

        'overdueCount', count(*) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
              and due_date::date < current_date
        ),
        'overdueValue', coalesce(sum(total_amount_myr - paid_to_date) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
              and due_date::date < current_date
        ), 0)
    )
    into result
    from base_bills;

    return result;
end;
$$;
