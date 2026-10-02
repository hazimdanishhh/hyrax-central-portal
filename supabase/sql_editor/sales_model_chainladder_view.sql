-- ############################################################################
-- v_sales_model_chainladder -- expected invoicing from the existing order book
--
-- Phase A of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md. §5.1 of the
-- architecture doc. Read-only view.
--
-- Depends on v_sales_orderbook_open (what is owed, and how old) and
-- v_sales_order_development (link ratios by age).
--
-- REBUILT 2026-10-02 alongside the development view. See that file's header
-- for why the previous share-of-original formulation over-predicted by ~60%.
--
-- THE CALCULATION
--
-- An order with remaining value R at age a contributes to horizon month h the
-- value that survives h-1 months unconverted and then converts:
--
--     R x [ product of (1 - r(a+j)) for j = 0 .. h-2 ] x r(a+h-1)
--
-- where r(x) is the link ratio at age x -- the share of still-outstanding
-- value that settles in the following month.
--
-- At h = 1 the product is empty and the contribution is simply R x r(a): what
-- this order is expected to invoice next month, given it has not invoiced yet.
--
-- PostgreSQL has no product aggregate, so the survival term is formed as
-- exp(sum(ln(1 - r))) using the survival_log column the development view
-- already computes. The lateral below sums over the open age interval
-- [a, a+h-1), which is empty for h = 1 -- hence the coalesce to 1.
--
-- WHY THIS NO LONGER NEEDS THE min_undeveloped FLOOR
--
-- The old formula divided by (1 - F(a)), which approaches zero at high ages
-- and made the conditional factor explode -- a dead order with a rounding
-- residual could project enormous revenue, so a floor was needed to contain
-- it. Link ratios have no such divisor: they are already conditional on being
-- outstanding. Where orders of a given age almost never convert, the measured
-- rate simply collapses toward zero and those orders contribute nothing,
-- without any artificial guard.
--
-- MAX_AGE IS KEPT, BUT NOW AS HYGIENE RATHER THAN AS A FIX
--
-- 41.5% of outstanding value sits in orders over 24 months old, with an
-- average age of 68 months (A4/A5) -- orders nobody closed in SAP rather than
-- business still pending. The link ratios would already give them a near-zero
-- rate, but excluding them keeps the exposure figure honest about what is
-- really being modelled. A7 reports how much value the cut-off removes.
--
-- THIS MODEL ALONE IS NOT A FORECAST
--
-- It projects only invoicing from orders ALREADY PLACED. It cannot see
-- business not yet won, and structurally cannot see the 27.4% of revenue
-- invoiced with no sales order at all (§11d). It SHOULD run below total
-- actuals at every horizon, increasingly so as the horizon extends. §6's
-- Bornhuetter-Ferguson blend supplies everything it cannot see, weighted by
-- the measured coverage curve.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_orderbook_open_view.sql and sales_order_development_view.sql.
-- ############################################################################

drop view if exists public.v_sales_model_chainladder cascade;

create view public.v_sales_model_chainladder
with (security_invoker = on) as

with params as (
    select 24 as max_age_months
),

-- AS MATERIALIZED is load-bearing. Without it this view is inlined into every
-- reference below and the development view -- which itself scans
-- sap_sales_orders and sap_invoice_lines with window functions -- is
-- recomputed for each one. The backtest view's first version expressed
-- survival as a CROSS JOIN LATERAL over this view and timed out outright.
dev as materialized (
    select age_months,
           link_rate,
           -- Cumulative log-survival STRICTLY BEFORE this age, so survival
           -- from age a across k months is a subtraction rather than a
           -- correlated subquery: exp(cum_log_before(a+k) - cum_log_before(a)).
           coalesce(
               sum(survival_log) over (
                   order by age_months
                   rows between unbounded preceding and 1 preceding
               ), 0
           ) as cum_log_before
    from public.v_sales_order_development
),

horizons as (
    select generate_series(1, 12) as horizon
),

exposure as (
    select h.horizon,
           (date_trunc('month', current_date) + (h.horizon || ' months')::interval)::date
                                                   as period_month,
           ob.doc_entry,
           ob.remaining_myr,
           ob.age_months,
           d_target.link_rate                      as rate_at_conversion,
           -- Probability of surviving unconverted from the order's current age
           -- up to the conversion month. The exponent is zero at horizon 1
           -- (both terms are the same row), giving survival = 1.
           exp(d_target.cum_log_before - d_now.cum_log_before)
                                                   as survival_to_target
    from public.v_sales_orderbook_open ob
    cross join horizons h
    cross join params p
    join dev d_now    on d_now.age_months    = ob.age_months
    join dev d_target on d_target.age_months = ob.age_months + h.horizon - 1
    where ob.age_months between 0 and p.max_age_months
)

select period_month,
       horizon,
       'chainladder'::text                                              as model,
       sum(remaining_myr * survival_to_target * rate_at_conversion)      as predicted,
       -- Variance under a Bernoulli-per-order view: each outstanding balance
       -- either converts in this month or does not, with probability
       -- p = survival x rate. Deliberately simple -- this model's dominant
       -- error is what it CANNOT see, not noise in what it can, and §7's
       -- between-model term is where that honestly lives.
       sum( power(remaining_myr, 2)
            * (survival_to_target * rate_at_conversion)
            * (1 - least(survival_to_target * rate_at_conversion, 1)) )   as variance,
       count(*)                                                          as orders_contributing,
       sum(remaining_myr)                                                as exposed_myr
from exposure
group by period_month, horizon
order by horizon;


comment on view public.v_sales_model_chainladder is
    'Expected invoicing from orders already placed, by horizon month. Uses '
    'link ratios with a survival product: R x prod(1-r) x r. Projects only '
    'committed business -- runs below total actuals by design; §6''s blend '
    'supplies what it cannot see.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseA_verification.sql
-- Run them one at a time, after this file has succeeded.
