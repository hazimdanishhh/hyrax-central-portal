-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Bills list page's OverviewCards -- AP mirror of
-- get_invoices_overview_rpc.sql. Plain function (NOT security definer), so
-- it runs with the caller's own row-security context: sap_vendor_bills'
-- existing "Finance Department VIEW" RLS policy already scopes every figure
-- below to whatever this caller could already see via fetchBills(). Formula
-- copied verbatim from get_finance_dashboard_rpc.sql's own AP KPIs. Due Soon
-- window is 7 days.
--
-- Filter-aware (added 2026-09), AP mirror of get_invoices_overview's own
-- filter treatment: every param below is null-guarded independently, per
-- DASHBOARD-CONVENTIONS.md's date-range rule. p_is_cancelled defaults to
-- excluding cancelled docs ('N') when not supplied. No p_sales_rep_code --
-- sap_vendor_bills has no such column (AP has no rep concept), matching
-- getBillsFilterConfig()'s own filter set. Deliberately NOT parameterized:
-- overdueOnly/dueSoonOnly/criticallyOverdueOnly -- those toggles are what
-- this page's own KPI tiles set on the list when clicked, so feeding them
-- back in would be circular. Don't add them here.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- Postgres identifies a
-- function by name + parameter *types*, so the previous zero-argument
-- get_bills_overview() is a genuinely different signature and would
-- otherwise keep existing as a second, separate overload after this file is
-- re-run, silently coexisting alongside the parameterized version below. The
-- explicit drop guarantees only one overload survives -- run it first.
drop function if exists public.get_bills_overview();

create or replace function public.get_bills_overview(
    p_vendor_code text default null,
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
    with base_bills as (
        select *
        from public.sap_vendor_bills
        where (
                case when p_is_cancelled is null then is_cancelled = 'N'
                     else is_cancelled = p_is_cancelled
                end
              )
          and (p_vendor_code is null or vendor_code = p_vendor_code)
          and (p_status_code is null or status_code = p_status_code)
          and (p_start_date is null or bill_date::date >= p_start_date)
          and (p_end_date is null or bill_date::date <= p_end_date)
          and (
                p_search is null
                or vendor_name ilike '%' || p_search || '%'
                or (p_search ~ '^\d+$' and bill_number::text = p_search)
              )
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
        ), 0),

        -- Added 2026-09: escalating-risk tile, AP mirror of
        -- get_invoices_overview's own criticallyOverdue -- vendor-
        -- relationship/interest-penalty risk compounds the same way past 90
        -- days.
        'criticallyOverdueCount', count(*) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
              and due_date::date < current_date - 90
        ),
        'criticallyOverdueValue', coalesce(sum(total_amount_myr - paid_to_date) filter (
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
              and due_date::date < current_date - 90
        ), 0)
    )
    into result
    from base_bills;

    return result;
end;
$$;
