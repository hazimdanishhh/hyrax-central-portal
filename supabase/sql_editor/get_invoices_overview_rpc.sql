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
--
-- Filter-aware (added 2026-09, matching fetchInvoices()'s own filter set so
-- this strip always summarizes exactly the rows the list would show for the
-- same filters): every param below is null-guarded independently, per
-- DASHBOARD-CONVENTIONS.md's date-range rule. p_is_cancelled defaults to
-- excluding cancelled docs ('N') when not supplied, matching the previous
-- hardcoded behavior -- only an explicit 'Y'/'N' overrides that default.
-- Deliberately NOT parameterized: overdueOnly/dueSoonOnly/
-- criticallyOverdueOnly. Those toggles are what this page's own KPI tiles set
-- on the list when clicked -- feeding them back into this RPC would be
-- circular (e.g. overdueOnly=true would force dueSoonCount to always be 0,
-- since overdue and due-soon are mutually exclusive by definition). Don't add
-- them here.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- Postgres identifies a
-- function by name + parameter *types*, so the previous zero-argument
-- get_invoices_overview() is a genuinely different signature and would
-- otherwise keep existing as a second, separate overload after this file is
-- re-run, silently coexisting alongside the parameterized version below. The
-- explicit drop guarantees only one overload survives -- run it first.
drop function if exists public.get_invoices_overview();

create or replace function public.get_invoices_overview(
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
    with base_invoices as (
        select *
        from public.sap_invoices
        where (
                case when p_is_cancelled is null then is_cancelled = 'N'
                     else is_cancelled = p_is_cancelled
                end
              )
          and (p_customer_code is null or customer_code = p_customer_code)
          and (p_sales_rep_code is null or sales_rep_code = p_sales_rep_code)
          and (p_status_code is null or status_code = p_status_code)
          and (p_start_date is null or invoice_date::date >= p_start_date)
          and (p_end_date is null or invoice_date::date <= p_end_date)
          and (
                p_search is null
                or customer_name ilike '%' || p_search || '%'
                or (p_search ~ '^\d+$' and invoice_number::text = p_search)
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

        -- Added 2026-09: escalating-risk tile, distinct from the plain
        -- Overdue figure above -- 1 day late and 120 days late are currently
        -- treated identically by that tile. 90-day threshold matches
        -- get_finance_dashboard_rpc.sql's own AR-aging "90+" bucket.
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
    from base_invoices;

    return result;
end;
$$;
