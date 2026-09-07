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
create or replace function public.get_payments_overview()
returns json
language plpgsql
as $$
declare
    result json;
begin
    with base_payments as (
        select *
        from public.sap_payments
        where is_cancelled = 'N'
    )
    select json_build_object(
        -- All-time snapshot, not period-bound -- matches every other tile's
        -- "always reflects the full picture" convention.
        'unallocatedCount', count(*) filter (where unallocated_amount > 0.01),
        'unallocatedValue', coalesce(sum(unallocated_amount) filter (where unallocated_amount > 0.01), 0),

        'thisWeekCount', count(*) filter (where payment_date::date >= current_date - 7),
        'thisWeekValue', coalesce(sum(total_amount_myr) filter (where payment_date::date >= current_date - 7), 0),

        'thisMonthCount', count(*) filter (where payment_date::date >= date_trunc('month', current_date)),
        'thisMonthValue', coalesce(sum(total_amount_myr) filter (where payment_date::date >= date_trunc('month', current_date)), 0)
    )
    into result
    from base_payments;

    return result;
end;
$$;
