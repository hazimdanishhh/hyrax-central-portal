-- ############################################################################
-- v_sales_chainladder_backtest -- how wrong is the order-book model, measured
--
-- Phase A exit criterion, docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view.
--
-- WHY THIS EXISTS
--
-- Verification A6 showed the chain-ladder projecting RM4.45M of invoicing next
-- month against roughly RM2.6M of order-sourced invoicing in reality. Two
-- rebuilds have not closed that gap, and continuing to adjust the model
-- against "that looks too high" is exactly the undisciplined loop the FVA gate
-- exists to prevent.
--
-- So: stop tuning, start measuring. This view runs the model at historical
-- origins and compares what it WOULD have said against what actually happened.
--
--   * consistently biased  -> correctable with a measured scaling factor, and
--                             still a strong ensemble input
--   * only biased recently -> the model is correctly reporting that the order
--                             book stopped converting, which is real signal
--
-- POINT-IN-TIME RECONSTRUCTION
--
-- At origin month o, an order's state is rebuilt from first principles: value
-- ordered on or before o, minus invoice lines dated on or before o. No
-- current-state column is read, so nothing from after the origin can leak into
-- the book being projected from.
--
-- THE TARGET IS DELIBERATELY NARROW
--
--   target_known_orders  invoicing in o+h from orders placed on or before o.
--                        THE FAIR TEST -- the only thing this model claims.
--   target_order_sourced all base_type = 17 invoicing in o+h, including from
--                        orders placed after the origin.
--   target_total         everything invoiced in o+h.
--
-- Scoring against target_total would build in a guaranteed shortfall, because
-- 27.4% of revenue has no sales order at all and the model has never claimed
-- to see it. The gap between the three measures how much work §6's a-priori
-- has to do.
--
-- ONE DISCLOSED SIMPLIFICATION
--
-- Link ratios come from v_sales_order_development over the full trailing
-- 36-month cohort window, so at an origin 12 months back, ratios informed
-- partly by later data are applied. This tests the model's STRUCTURE, not its
-- parameter estimation. Acceptable here because the question is a bias of
-- order ~70%, which a slow-moving structural parameter cannot manufacture. It
-- would NOT be acceptable for a published accuracy figure -- Phase E uses
-- frozen snapshots precisely so no such caveat applies.
--
-- ############################################################################
-- PERFORMANCE -- rewritten 2026-10-02 after the first version timed out
--
-- The original computed survival with a CROSS JOIN LATERAL that re-queried
-- v_sales_order_development once per (open order x horizon) -- roughly 270,000
-- correlated subqueries, each re-evaluating a view that itself scans
-- sap_sales_orders and sap_invoice_lines with window functions. Postgres
-- inlines ordinary CTEs, so the development view was recomputed over and over.
--
-- Two fixes, both structural rather than cosmetic:
--
--   1. `dev` is declared AS MATERIALIZED, forcing exactly one evaluation of
--      the development view for the whole query.
--   2. The survival product is precomputed as a PREFIX SUM of log(1-r) over
--      ages. Survival from age a across k months is then
--      exp(cum_log(a+k) - cum_log(a)) -- two ordinary joins and a subtraction,
--      replacing the lateral entirely.
--
-- `orders` is also date-bounded, so orders that could never fall inside any
-- origin window are discarded before the month-grid join rather than after.
-- ############################################################################

-- `create or replace` rather than `drop ... cascade`. Dropping deletes every
-- dependant view, which on 2026-10-03 silently removed six of them and cost a
-- full rebuild. Switch back to `drop view if exists ... cascade` ONLY when the
-- COLUMN LIST changes -- renamed, removed, reordered or retyped. Postgres
-- raises 42P16 when that happens, so it tells you; APPENDING a column at the
-- end needs no drop. Full rule in sales_projection_baseline_view.sql.
create or replace view public.v_sales_chainladder_backtest
with (security_invoker = on) as

with bounds as (
    select (date_trunc('month', current_date) - interval '30 months')::date as first_origin,
           (date_trunc('month', current_date) - interval '1 month')::date   as last_closed_month
),

-- AS MATERIALIZED is load-bearing, not a style choice: without it this view is
-- inlined into every reference below and recomputed each time.
dev as materialized (
    select age_months,
           link_rate,
           -- Cumulative log-survival STRICTLY BEFORE this age. Survival from
           -- age a across k months is exp(cum_log_before(a+k) - cum_log_before(a)).
           coalesce(
               sum(survival_log) over (
                   order by age_months
                   rows between unbounded preceding and 1 preceding
               ), 0
           ) as cum_log_before
    from public.v_sales_order_development
),

months as (
    select gs::date as month
    from bounds b
    cross join lateral generate_series(
        (b.first_origin - interval '24 months')::date,
        b.last_closed_month,
        interval '1 month'
    ) gs
),

orders as (
    select so.doc_entry,
           date_trunc('month', so.order_date::date)::date as order_month,
           so.total_amount_myr                            as ordered_myr
    from public.sap_sales_orders so
    cross join bounds b
    where so.is_cancelled = 'N'
      and so.total_amount_myr > 0
      -- Only orders that can still be inside some origin's 24-month window.
      and so.order_date::date >= (b.first_origin - interval '25 months')::date
),

inv_by_month as (
    select il.base_entry                                  as doc_entry,
           date_trunc('month', i.invoice_date::date)::date as invoice_month,
           sum(il.line_total)                             as amt
    from public.sap_invoice_lines il
    join public.sap_invoices i
      on i.doc_entry = il.doc_entry
     and i.is_cancelled = 'N'
    where il.base_type = 17
      and il.base_entry is not null
    group by 1, 2
),

order_state as (
    select o.doc_entry,
           o.ordered_myr,
           m.month,
           ( (extract(year from m.month) - extract(year from o.order_month)) * 12
           + (extract(month from m.month) - extract(month from o.order_month))
           )::int as age_months,
           sum(coalesce(ibm.amt, 0)) over (
               partition by o.doc_entry order by m.month
               rows between unbounded preceding and current row
           ) as cum_invoiced
    from orders o
    join months m
      on m.month >= o.order_month
     and m.month <  (o.order_month + interval '25 months')::date
    left join inv_by_month ibm
      on ibm.doc_entry     = o.doc_entry
     and ibm.invoice_month = m.month
),

book as (
    select os.month as origin_month,
           os.age_months,
           greatest(os.ordered_myr - os.cum_invoiced, 0) as remaining_myr
    from order_state os
    cross join bounds b
    where os.month >= b.first_origin
      and os.ordered_myr - os.cum_invoiced > 0
      and os.age_months between 0 and 24
),

horizons as (
    -- Extended from 6 to 12 in Phase B. Nothing had been scored past six
    -- months while the design publishes a twelve-month figure. Affordable only
    -- because the survival lateral was replaced with a prefix sum -- the
    -- original form timed out at six.
    select generate_series(1, 12) as horizon
),

projected as (
    select bk.origin_month,
           h.horizon,
           (bk.origin_month + (h.horizon || ' months')::interval)::date as target_month,
           sum(
               bk.remaining_myr
               -- survival across the h-1 months before conversion
               * exp(d_target.cum_log_before - d_now.cum_log_before)
               * d_target.link_rate
           ) as predicted
    from book bk
    cross join horizons h
    join dev d_now    on d_now.age_months    = bk.age_months
    join dev d_target on d_target.age_months = bk.age_months + h.horizon - 1
    group by 1, 2, 3
),

actuals as (
    select date_trunc('month', i.invoice_date::date)::date as invoice_month,
           date_trunc('month', so.order_date::date)::date  as order_month,
           sum(il.line_total)                              as amt
    from public.sap_invoice_lines il
    join public.sap_invoices i
      on i.doc_entry = il.doc_entry
     and i.is_cancelled = 'N'
    left join public.sap_sales_orders so
      on so.doc_entry    = il.base_entry
     and il.base_type    = 17
     and so.is_cancelled = 'N'
    group by 1, 2
)

select p.origin_month,
       p.horizon,
       p.target_month,
       p.predicted,

       coalesce(sum(a.amt) filter (
           where a.order_month is not null and a.order_month <= p.origin_month
       ), 0)                                                    as target_known_orders,

       coalesce(sum(a.amt) filter (where a.order_month is not null), 0)
                                                                as target_order_sourced,

       coalesce(sum(a.amt), 0)                                  as target_total,

       p.predicted - coalesce(sum(a.amt) filter (
           where a.order_month is not null and a.order_month <= p.origin_month
       ), 0)                                                    as error_vs_known

from projected p
left join actuals a on a.invoice_month = p.target_month
cross join bounds b
where p.target_month <= b.last_closed_month
group by p.origin_month, p.horizon, p.target_month, p.predicted
order by p.origin_month, p.horizon;


comment on view public.v_sales_chainladder_backtest is
    'Chain-ladder scored at historical origins with a point-in-time order book '
    'reconstruction. target_known_orders is the fair comparison. Survival uses '
    'a prefix-sum of log(1-r) against a MATERIALIZED dev CTE -- the lateral '
    'form timed out. Link ratios carry a disclosed mild lookahead.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseA_verification.sql (A9-A11).
