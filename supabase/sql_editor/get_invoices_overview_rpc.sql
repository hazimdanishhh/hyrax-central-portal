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
--
-- overdueOnly/dueSoonOnly/criticallyOverdueOnly/hasBalanceOnly/
-- paidMismatchOnly/customerCodes (added 2026-09, Total tile): these are real
-- fetchInvoices() filters too, but are deliberately NOT folded into
-- base_invoices below -- doing so would make the Outstanding/Due Soon/
-- Overdue/Critically Overdue tiles circular (e.g. overdueOnly=true would
-- force dueSoonCount to always read 0, since overdue and due-soon are
-- mutually exclusive by definition), and those four tiles are meant to keep
-- summarizing the whole (toggle-excluded) portfolio exactly as before. They
-- only narrow the separate totals_scope CTE below, which backs the new
-- totalCount/totalValue fields for the page's own Total tile. Known gap, not
-- silently dropped: p_sales_order_doc_entry (fetchInvoices' drill-through-
-- only filter, resolved async via sap_invoice_lines/sap_delivery_lines, no
-- UI control on this page) is NOT accepted here -- porting that multi-table
-- document-trail join into SQL isn't worth it for a path the code's own
-- comment confirms is legacy-only (no invoice has used it since 2022-05-25).
--
-- base_invoices now sources from sap_invoices_with_balance (see
-- finance_outstanding_balance_views.sql), not the raw sap_invoices table --
-- a pure superset of columns (adds outstanding_balance/has_paid_mismatch), so
-- every existing tile below (which only ever reference status_code/
-- total_amount_myr/paid_to_date/due_date) is unaffected; this just lets
-- totals_scope reuse the view's own already-validated balance/mismatch
-- columns instead of re-deriving that join a third time.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- Postgres identifies a
-- function by name + parameter *types*, so the previous zero-argument
-- get_invoices_overview() is a genuinely different signature and would
-- otherwise keep existing as a second, separate overload after this file is
-- re-run, silently coexisting alongside the parameterized version below. The
-- explicit drop guarantees only one overload survives -- run it first.
drop function if exists public.get_invoices_overview();
drop function if exists public.get_invoices_overview(text, bigint, text, text, date, date, text);

create or replace function public.get_invoices_overview(
    p_customer_code text default null,
    p_sales_rep_code bigint default null,
    p_status_code text default null,
    p_is_cancelled text default null,
    p_start_date date default null,
    p_end_date date default null,
    p_search text default null,
    p_has_balance_only boolean default null,
    p_paid_mismatch_only boolean default null,
    p_overdue_only boolean default null,
    p_due_soon_only boolean default null,
    p_critically_overdue_only boolean default null,
    p_customer_codes text default null
)
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_invoices as (
        select *
        from public.sap_invoices_with_balance
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
    ),
    -- Backs only totalCount/totalValue below -- see the header comment for
    -- why these toggles narrow this CTE instead of base_invoices itself.
    totals_scope as (
        select *
        from base_invoices
        where (p_customer_codes is null or customer_code = any(string_to_array(p_customer_codes, ',')))
          and (p_has_balance_only is not true or outstanding_balance > 0.01)
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
        ), 0),

        -- Added 2026-09: page-wide Total tile -- gross total_amount_myr
        -- (NOT balance, unlike every tile above) across every invoice
        -- matching the CURRENT filters, including the toggles base_invoices
        -- itself deliberately excludes -- see totals_scope above.
        'totalCount', (select count(*) from totals_scope),
        'totalValue', (select coalesce(sum(total_amount_myr), 0) from totals_scope)
    )
    into result
    from base_invoices;

    return result;
end;
$$;
