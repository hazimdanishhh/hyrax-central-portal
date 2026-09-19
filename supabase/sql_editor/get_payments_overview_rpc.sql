-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Payments list page's OverviewCards -- plain
-- function (NOT security definer), so it runs with the caller's own
-- row-security context: sap_payments' existing RLS already scopes every
-- figure below to whatever this caller could already see via fetchPayments(),
-- same as get_projects_overview's own reasoning.
--
-- Unlike Sales Orders/Invoices/Bills, sap_payments has no due-date-shaped
-- field at all (a payment is an already-settled transaction, not something
-- that can itself be "overdue") -- so the tiles here are a different shape:
-- unallocated_amount (NoDocSum, "cash sitting unapplied against any invoice")
-- is the one genuinely actionable, never-before-surfaced-as-a-plain-stat
-- figure (get_finance_dashboard_rpc.sql aggregates it too, but only inside a
-- period-bound chart-card total, never as a headline number), plus two
-- volume-pulse figures (This Week / This Month) since there's no backlog
-- concept to flag urgency on here.
--
-- Filter-aware (added 2026-09, matching fetchPayments()'s own filter set):
-- p_start_date/p_end_date scope this page's own period filter on
-- payment_date -- independently null-guarded, per
-- DASHBOARD-CONVENTIONS.md's date-range rule -- and simply AND with the
-- existing thisWeek/thisMonth relative-to-today windows below (e.g. picking
-- a historical period will naturally zero out thisWeek/thisMonth, since both
-- windows must then be satisfied at once -- expected, not a bug). No
-- p_sales_rep_code/p_status_code -- sap_payments has neither column, matching
-- getPaymentsFilterConfig()'s own filter set. p_is_cancelled defaults to
-- excluding cancelled docs ('N') when not supplied.
--
-- unallocatedOnly (added 2026-09, Total tile): a real fetchPayments() filter,
-- but deliberately NOT folded into base_payments below -- that's what this
-- page's own Unallocated tile sets on the list when clicked, so feeding it
-- back into base_payments would be circular. It only narrows the separate
-- totals_scope CTE below, which backs the new totalCount/totalValue fields
-- for the page's own Total tile. Known gap, not silently dropped:
-- p_sales_order_doc_entry (fetchPayments' drill-through-only filter, a
-- 2-hop async resolve via sap_payment_applications/sap_invoice_lines/
-- sap_delivery_lines, no UI control on this page) is NOT accepted here --
-- not worth porting that join into SQL for a rare navigation-only path.
--
-- IMPORTANT: `create or replace function` can only replace a function whose
-- argument list is IDENTICAL to the new one -- Postgres identifies a
-- function by name + parameter *types*, so the previous zero-argument
-- get_payments_overview() is a genuinely different signature and would
-- otherwise keep existing as a second, separate overload after this file is
-- re-run, silently coexisting alongside the parameterized version below. The
-- explicit drop guarantees only one overload survives -- run it first.
drop function if exists public.get_payments_overview();
drop function if exists public.get_payments_overview(text, text, date, date, text);

create or replace function public.get_payments_overview(
    p_customer_code text default null,
    p_is_cancelled text default null,
    p_start_date date default null,
    p_end_date date default null,
    p_search text default null,
    p_unallocated_only boolean default null
)
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_payments as (
        select *
        from public.sap_payments
        where (
                case when p_is_cancelled is null then is_cancelled = 'N'
                     else is_cancelled = p_is_cancelled
                end
              )
          and (p_customer_code is null or customer_code = p_customer_code)
          and (p_start_date is null or payment_date::date >= p_start_date)
          and (p_end_date is null or payment_date::date <= p_end_date)
          and (
                p_search is null
                or customer_name ilike '%' || p_search || '%'
                or (p_search ~ '^\d+$' and receipt_number::text = p_search)
              )
    ),
    -- Backs only totalCount/totalValue below -- see the header comment for
    -- why unallocatedOnly narrows this CTE instead of base_payments itself.
    totals_scope as (
        select *
        from base_payments
        where (p_unallocated_only is not true or unallocated_amount > 0.01)
    )
    select json_build_object(
        'unallocatedCount', count(*) filter (where unallocated_amount > 0.01),
        'unallocatedValue', coalesce(sum(unallocated_amount) filter (where unallocated_amount > 0.01), 0),

        'thisWeekCount', count(*) filter (where payment_date::date >= current_date - 7),
        'thisWeekValue', coalesce(sum(total_amount_myr) filter (where payment_date::date >= current_date - 7), 0),

        'thisMonthCount', count(*) filter (where payment_date::date >= date_trunc('month', current_date)),
        'thisMonthValue', coalesce(sum(total_amount_myr) filter (where payment_date::date >= date_trunc('month', current_date)), 0),

        -- Added 2026-09: page-wide Total tile -- total_amount_myr across
        -- every payment matching the CURRENT filters, including
        -- unallocatedOnly, which base_payments itself deliberately excludes
        -- -- see totals_scope above.
        'totalCount', (select count(*) from totals_scope),
        'totalValue', (select coalesce(sum(total_amount_myr), 0) from totals_scope)
    )
    into result
    from base_payments;

    return result;
end;
$$;
