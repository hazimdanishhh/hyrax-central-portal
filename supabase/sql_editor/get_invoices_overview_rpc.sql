-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Invoices list page's OverviewCards -- plain
-- function (NOT security definer), so it runs with the caller's own
-- row-security context: sap_invoices' existing per-department RLS policies
-- (Finance/MGM/Operations) already scope every figure below to whatever this
-- caller could already see via fetchInvoices(), same as get_projects_overview's
-- own reasoning. Outstanding/overdue formula (balance = total - paid, > 0.01
-- epsilon guard against floating-point-settled balances) is copied verbatim
-- from get_finance_dashboard_rpc.sql's own AR KPIs, not reinvented, so this
-- page's numbers can never quietly drift from the Finance dashboard's.
-- Due Soon window is 7 days.
create or replace function public.get_invoices_overview()
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_invoices as (
        select *
        from public.sap_invoices
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
    from base_invoices;

    return result;
end;
$$;
