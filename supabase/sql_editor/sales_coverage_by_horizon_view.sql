-- ############################################################################
-- v_sales_coverage_by_horizon -- how much of a month is knowable in advance
--
-- Phase A of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md. §6 of the
-- architecture doc. Read-only view.
--
-- THE NUMBER THAT DRIVES THE BLEND
--
-- §6's Bornhuetter-Ferguson combination is:
--
--     Projection(m, h) = OrderBook(m) + (1 - coverage(h)) x APriori(m, h)
--
-- coverage(h) is the historically measured share of a month's invoiced value
-- that came from orders already placed at least h months earlier -- i.e. the
-- share that was ALREADY VISIBLE h months ahead of time.
--
-- It is MEASURED, not chosen. That is the whole point: the handover from
-- "count what we know" to "estimate what we don't" happens at the rate the
-- business actually behaves, rather than at a cutoff someone picked. Q3 of the
-- order-book diagnostic measured h=1 at about 60%; this view computes the
-- whole curve, h = 1..12, so the blend has a weight for every horizon.
--
-- Expect it to decay fast. Q4 showed 46% of order value invoices within one
-- month of being ordered and 80% within four, so by h=6 very little of a
-- month's revenue was foreseeable that far out, and the a-priori carries
-- almost all the weight.
--
-- WHAT COUNTS AS "KNOWABLE"
--
-- An invoice line is knowable at horizon h if its sales order was placed at
-- least h months before the invoice month. Lines with no sales order
-- (base_type <> 17, 27.4% of value per §11d) are never knowable in advance --
-- they are counted in the denominator and never in the numerator, which is
-- exactly right: they are real revenue the order book cannot predict, and
-- coverage(h) must be diluted by them.
--
-- WINDOW: TRAILING 36 MONTHS
--
-- Same reasoning as the development factors. The 2018-2024 structural shift
-- means older months describe a different business. The current month is
-- excluded entirely -- it is partial, and a partial month inflates coverage
-- because only the early, already-booked invoices have landed yet.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- ############################################################################

drop view if exists public.v_sales_coverage_by_horizon cascade;

create view public.v_sales_coverage_by_horizon
with (security_invoker = on) as

with bounds as (
    select (date_trunc('month', current_date) - interval '36 months')::date as window_start,
           date_trunc('month', current_date)::date                          as current_month
),

-- Every invoice line in the window, with the month its order was placed
-- (null when the line has no sales order behind it).
lines as (
    select date_trunc('month', i.invoice_date::date)::date   as invoice_month,
           date_trunc('month', so.order_date::date)::date    as order_month,
           il.line_total
    from public.sap_invoice_lines il
    join public.sap_invoices i
      on i.doc_entry = il.doc_entry
     and i.is_cancelled = 'N'
    left join public.sap_sales_orders so
      on so.doc_entry   = il.base_entry
     and il.base_type   = 17
     and so.is_cancelled = 'N'
    cross join bounds b
    where i.invoice_date::date >= b.window_start
      and i.invoice_date::date <  b.current_month      -- exclude the partial month
),

horizons as (
    select generate_series(1, 12) as horizon
),

-- For each horizon, how much of each month's invoicing was already on the
-- books that far ahead.
per_month as (
    select h.horizon,
           l.invoice_month,
           sum(l.line_total)                                      as invoiced_myr,
           sum(l.line_total) filter (
               where l.order_month is not null
                 and l.order_month <= (l.invoice_month - (h.horizon || ' months')::interval)::date
           )                                                      as knowable_myr
    from lines l
    cross join horizons h
    group by h.horizon, l.invoice_month
)

select horizon,
       count(*)                                                   as months_observed,
       sum(invoiced_myr)                                          as invoiced_myr,
       sum(knowable_myr)                                          as knowable_myr,
       -- Volume-weighted: the share of total value foreseeable at this
       -- horizon. This is coverage(h), the figure §6 uses.
       sum(knowable_myr) / nullif(sum(invoiced_myr), 0)            as coverage,
       -- Unweighted mean of the monthly shares, plus their spread. A large gap
       -- between this and `coverage` means a few big months dominate; a large
       -- stddev means coverage itself is unstable and the blend weight should
       -- not be trusted precisely.
       avg(knowable_myr / nullif(invoiced_myr, 0))                as coverage_mean_of_months,
       stddev_samp(knowable_myr / nullif(invoiced_myr, 0))        as coverage_stddev,
       min(knowable_myr / nullif(invoiced_myr, 0))                as coverage_min,
       max(knowable_myr / nullif(invoiced_myr, 0))                as coverage_max
from per_month
group by horizon
order by horizon;


comment on view public.v_sales_coverage_by_horizon is
    'Measured share of a month''s invoiced value already visible h months '
    'ahead, h = 1..12. Drives the Bornhuetter-Ferguson weight in §6. Lines '
    'with no sales order dilute the numerator by design -- they are revenue '
    'the order book structurally cannot foresee.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseA_verification.sql
-- Run them one at a time, after this file has succeeded.
