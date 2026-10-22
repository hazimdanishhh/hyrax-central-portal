-- ############################################################################
-- sales_reports_tabs_reconciliation.sql -- READ-ONLY. Changes nothing.
--
-- Compares the new metric layer (sales_totals, sales_metric_functions.sql)
-- with the current get_sales_reports_dashboard RPC, month by month for the
-- last 12 complete months, company-wide. Run it in the Supabase SQL editor
-- AFTER both of these have been run:
--   1. supabase/sql_editor/get_sales_reports_dashboard_rpc.sql (2026-10-22 fixes)
--   2. supabase/sql_editor/sales_metric_facts_views.sql
--   3. supabase/sql_editor/sales_metric_functions.sql
--
-- WHAT TO EXPECT (docs/sales/SALES-REPORTS-TABS-PLAN.md §6 step 2). Every
-- non-zero difference must be one of these; anything else is a bug to
-- investigate before the new tabs replace the old page:
--
--   invoiced, invoice_count, booked, order_count,
--   budget, target                       -> 0 difference
--   collected, payment_count             -> 0 (both use "cash applied to a real
--                                           A/R invoice" and distinct receipts
--                                           since the 2026-10-22 RPC fix; if
--                                           that file was NOT run, expect the
--                                           old rep-attributed rule: D2/D8)
--   won, won_count                       -> may differ, by design:
--       D5  cancelled WON leads no longer count as won revenue
--       D12 close dates are taken in Malaysia time, so a deal closed in the
--           first 8 hours of a month (UTC evening of the previous day) moves
--           from the previous month into the right one
--     The second query below lists exactly which leads cause each difference.
--
-- The old RPC has an access guard that reads auth.uid(), which is empty in
-- the SQL editor. Put YOUR OWN profile id (a superadmin, or a SAL / MGM
-- manager) on the marked line; it only applies inside this transaction.
-- ############################################################################

begin;

-- ▼▼▼ your profiles.id here ▼▼▼
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

with months as (
    select
        m::date as month_start,
        (m + interval '1 month' - interval '1 day')::date as month_end
    from generate_series(
        date_trunc('month', current_date) - interval '12 months',
        date_trunc('month', current_date) - interval '1 month',
        interval '1 month'
    ) m
),
old_kpis as (
    select
        mo.month_start,
        (public.get_sales_reports_dashboard(mo.month_start, mo.month_end, null, null)::jsonb -> 'kpis') as k
    from months mo
),
new_totals as (
    select mo.month_start, t.*
    from months mo
    cross join lateral public.sales_totals(null, null, mo.month_start, mo.month_end) t
)
select
    to_char(n.month_start, 'YYYY-MM')                                        as month,
    round((o.k ->> 'totalInvoiced')::numeric, 2)                             as old_invoiced,
    round(n.invoiced, 2)                                                     as new_invoiced,
    round(n.invoiced - (o.k ->> 'totalInvoiced')::numeric, 2)                as diff_invoiced,
    n.invoice_count - (o.k ->> 'invoiceCount')::bigint                      as diff_invoice_count,
    round(n.booked - (o.k ->> 'orderBookValue')::numeric, 2)                 as diff_booked,
    n.order_count - (o.k ->> 'orderBookCount')::bigint                      as diff_order_count,
    round(n.collected - (o.k ->> 'totalCollected')::numeric, 2)              as diff_collected,
    n.payment_count - (o.k ->> 'paymentCount')::bigint                      as diff_payment_count,
    round(coalesce(n.budget, 0) - (o.k ->> 'revenueBudgetTotal')::numeric, 2) as diff_budget,
    round(coalesce(n.target, 0) - (o.k ->> 'pipelineTargetRevenue')::numeric, 2) as diff_target,
    round((o.k ->> 'pipelineWonRevenue')::numeric, 2)                        as old_won,
    round(n.won, 2)                                                          as new_won,
    round(n.won - (o.k ->> 'pipelineWonRevenue')::numeric, 2)                as diff_won_expected_d5_d12
from new_totals n
join old_kpis o on o.month_start = n.month_start
order by n.month_start;

-- The leads behind any won difference: cancelled WON leads (D5), and WON
-- leads whose close lands in a different month in Malaysia time than in UTC
-- (D12). If every won difference above is explained by rows here, won
-- reconciles.
with closing as (
    select lead_id, max(changed_at) as closed_at
    from public.sales_leads_stage_history
    where new_stage in ('WON', 'LOST')
    group by lead_id
)
select
    sl.id,
    sl.title,
    sl.actual_revenue,
    sl.is_cancelled,
    coalesce(c.closed_at, sl.updated_at)                                     as closed_at_utc,
    (coalesce(c.closed_at, sl.updated_at) at time zone 'Asia/Kuala_Lumpur')  as closed_at_myt,
    case
        when sl.is_cancelled then 'D5: cancelled, no longer counted as won'
        else 'D12: month changes in Malaysia time'
    end as reason
from public.sales_leads sl
left join closing c on c.lead_id = sl.id
where sl.stage = 'WON'
  and coalesce(c.closed_at, sl.updated_at) >= date_trunc('month', current_date) - interval '12 months'
  and (
        sl.is_cancelled
     or date_trunc('month', coalesce(c.closed_at, sl.updated_at) at time zone 'UTC')
        <> date_trunc('month', coalesce(c.closed_at, sl.updated_at) at time zone 'Asia/Kuala_Lumpur')
  )
order by closed_at_utc;

rollback;
