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
-- getBillsFilterConfig()'s own filter set.
--
-- overdueOnly/dueSoonOnly/criticallyOverdueOnly/hasBalanceOnly/
-- paidMismatchOnly (added 2026-09, Total tile): real fetchBills() filters,
-- but deliberately NOT folded into base_bills below -- same reasoning as
-- get_invoices_overview's own header comment (would make the Outstanding/
-- Due Soon/Overdue/Critically Overdue tiles circular). They only narrow the
-- separate totals_scope CTE below, which backs the new totalCount/
-- totalValue fields for the page's own Total tile.
--
-- base_bills now sources from sap_vendor_bills_with_balance (see
-- finance_outstanding_balance_views.sql), not the raw sap_vendor_bills
-- table -- a pure superset of columns (adds outstanding_balance/
-- has_paid_mismatch), so every existing tile below is unaffected; this just
-- lets totals_scope reuse the view's own already-validated balance/mismatch
-- columns instead of re-deriving that join a second time.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- Postgres identifies a
-- function by name + parameter *types*, so the previous zero-argument
-- get_bills_overview() is a genuinely different signature and would
-- otherwise keep existing as a second, separate overload after this file is
-- re-run, silently coexisting alongside the parameterized version below. The
-- explicit drop guarantees only one overload survives -- run it first.
drop function if exists public.get_bills_overview();
drop function if exists public.get_bills_overview(text, text, text, date, date, text);

create or replace function public.get_bills_overview(
    p_vendor_code text default null,
    p_status_code text default null,
    p_is_cancelled text default null,
    p_start_date date default null,
    p_end_date date default null,
    p_search text default null,
    p_has_balance_only boolean default null,
    p_paid_mismatch_only boolean default null,
    p_overdue_only boolean default null,
    p_due_soon_only boolean default null,
    p_critically_overdue_only boolean default null
)
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_bills as (
        select *
        from public.sap_vendor_bills_with_balance
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
    ),
    -- Backs only totalCount/totalValue below -- see the header comment for
    -- why these toggles narrow this CTE instead of base_bills itself.
    totals_scope as (
        select *
        from base_bills
        where (p_has_balance_only is not true or outstanding_balance > 0.01)
          and (p_paid_mismatch_only is not true or has_paid_mismatch)
          and (p_overdue_only is not true or (status_code = 'O' and due_date::date < current_date))
          and (p_due_soon_only is not true or (status_code = 'O' and due_date::date >= current_date and due_date::date <= current_date + 7))
          and (p_critically_overdue_only is not true or (status_code = 'O' and due_date::date < current_date - 90))
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
        ), 0),

        -- Added 2026-09: page-wide Total tile -- gross total_amount_myr
        -- (NOT balance, unlike every tile above) across every bill matching
        -- the CURRENT filters, including the toggles base_bills itself
        -- deliberately excludes -- see totals_scope above.
        'totalCount', (select count(*) from totals_scope),
        'totalValue', (select coalesce(sum(total_amount_myr), 0) from totals_scope)
    )
    into result
    from base_bills;

    return result;
end;
$$;
