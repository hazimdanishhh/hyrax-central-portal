-- ############################################################################
-- SALES PROJECTIONS -- PHASE A VERIFICATION
--
-- Read-only. Run ONE BLOCK AT A TIME and keep each output.
--
-- PREREQUISITE -- run these four files first, in this order, each on its own:
--     1. sql_editor/sales_order_development_view.sql
--     2. sql_editor/sales_orderbook_open_view.sql
--     3. sql_editor/sales_model_chainladder_view.sql
--     4. sql_editor/sales_coverage_by_horizon_view.sql
--
-- A1-A2 validate the development curve. A3-A5 validate the order book, and A3
-- is the one that confirms the fulfillment-view defect does not leak in.
-- A6-A7 are the model output. A8 is the blend weight.
-- ############################################################################


-- ############################################################################
-- A1 -- Link ratios by age
--
-- link_rate is the share of still-OUTSTANDING order value that converts in the
-- following month. This replaces the share-of-original factors the first
-- version reported; see the development view's header for why.
--
-- EXPECT: a high rate at age 0-1 (fresh orders convert fast), falling steeply,
-- and approaching zero past ~12 months. The fall is the point -- it is the
-- model learning that old outstanding orders are mostly dead rather than
-- pending, which is what A6's over-prediction was caused by missing.
--
-- WATCH 1: cohorts_used must FALL as age rises. That is the maturity rule
-- working -- a cohort only contributes to age a if it has lived through a+1
-- months. Flat counts mean immature cohorts are being counted as zeros.
--
-- WATCH 2: any link_rate pinned at exactly 0.95 is hitting the clamp, which
-- means that age had almost no outstanding value left to measure. Treat those
-- ages as unreliable rather than as genuinely fast-converting.
-- ############################################################################
select age_months,
       cohorts_used,
       round(outstanding_myr)                  as outstanding_myr,
       round(converted_next_myr)               as converted_next_myr,
       round(link_rate::numeric, 4)            as link_rate,
       round(implied_cumulative::numeric, 4)   as implied_cumulative
from public.v_sales_order_development
where age_months <= 12
order by age_months;


-- ############################################################################
-- A2 -- Does the implied curve still terminate sensibly?
--
-- implied_cumulative reconstructs "share of original order value developed by
-- this age" from the link ratios, so it is directly comparable with the first
-- version's figures: cum_at_12 was 0.9136 and cum_at_24 was 0.9554.
--
-- These should land in broadly the same place. A LARGE divergence means the
-- two formulations disagree about the underlying data rather than merely
-- about how to apply it, and needs explaining before the model is trusted.
-- ############################################################################
select round(max(implied_cumulative) filter (where age_months = 3)::numeric, 4)  as cum_at_3,
       round(max(implied_cumulative) filter (where age_months = 6)::numeric, 4)  as cum_at_6,
       round(max(implied_cumulative) filter (where age_months = 12)::numeric, 4) as cum_at_12,
       round(max(implied_cumulative) filter (where age_months = 24)::numeric, 4) as cum_at_24
from public.v_sales_order_development;


-- ############################################################################
-- A3 -- ★ Does line-level attribution actually differ from the broken view? ★
--
-- This is the check that proves v_sales_orderbook_open avoided the defect, AND
-- it measures how bad that defect is on the Fulfillment page.
--
-- line_level_invoiced is what we compute. doc_level_invoiced is what
-- sap_sales_orders_with_fulfillment reports. Any order where doc exceeds line
-- is one the Fulfillment card currently over-states.
--
-- Paste the summary row into DASHBOARD-ROADMAP.md §4 Group C -- it is the
-- magnitude that entry says is unmeasured.
-- ############################################################################
with line_level as (
    select il.base_entry as doc_entry, sum(il.line_total) as line_invoiced
    from public.sap_invoice_lines il
    join public.sap_invoices i on i.doc_entry = il.doc_entry and i.is_cancelled = 'N'
    where il.base_type = 17 and il.base_entry is not null
    group by il.base_entry
)
select count(*)                                                        as orders_compared,
       count(*) filter (where f.total_invoiced_myr > l.line_invoiced * 1.01)
                                                                       as orders_overstated,
       round(100.0 * count(*) filter (where f.total_invoiced_myr > l.line_invoiced * 1.01)
             / nullif(count(*), 0), 1)                                 as pct_overstated,
       round(sum(l.line_invoiced))                                     as line_level_total,
       round(sum(f.total_invoiced_myr))                                as doc_level_total,
       round(sum(f.total_invoiced_myr) - sum(l.line_invoiced))         as overstatement_myr,
       round(100.0 * (sum(f.total_invoiced_myr) - sum(l.line_invoiced))
             / nullif(sum(l.line_invoiced), 0), 1)                     as overstatement_pct
from line_level l
join public.sap_sales_orders_with_fulfillment f on f.doc_entry = l.doc_entry
where f.is_cancelled = 'N';


-- ############################################################################
-- A4 -- The open order book, by age
--
-- Compare the total against Q6's RM31.2M. This view defines "open" by
-- remaining value rather than status_code, so the figures will differ -- that
-- is intended, not a bug.
--
-- WATCH: how much value sits beyond 24 months. The model excludes it
-- (MAX_AGE), so a large figure here means a large chunk of the book is being
-- written off as dead. Worth knowing, and worth asking Sales about.
-- ############################################################################
select case
         when age_months <= 1  then '0-1 months'
         when age_months <= 3  then '2-3 months'
         when age_months <= 6  then '4-6 months'
         when age_months <= 12 then '7-12 months'
         when age_months <= 24 then '13-24 months'
         else                       'over 24 months (EXCLUDED from model)'
       end                                   as age_bucket,
       count(*)                              as orders,
       round(sum(ordered_myr))               as ordered_myr,
       round(sum(invoiced_myr))              as invoiced_myr,
       round(sum(remaining_myr))             as remaining_myr,
       round(100.0 * sum(remaining_myr)
             / sum(sum(remaining_myr)) over (), 1) as pct_of_book
from public.v_sales_orderbook_open
group by 1
order by min(age_months);


-- ############################################################################
-- A5 -- Data-quality flags on the order book
--
-- over_invoiced orders are floored to zero remaining by the view. A handful is
-- normal (price adjustments); a large count means the line-level attribution
-- is catching invoice lines that do not belong to the order.
-- ############################################################################
select invoice_state,
       count(*)                                        as orders,
       count(*) filter (where is_over_invoiced)        as over_invoiced,
       round(sum(remaining_myr))                       as remaining_myr,
       round(avg(age_months), 1)                       as avg_age_months
from public.v_sales_orderbook_open
group by invoice_state
order by remaining_myr desc;


-- ############################################################################
-- A6 -- Chain-ladder output, next 12 months
--
-- The forward projection from committed orders alone.
--
-- WATCH: these should DECAY toward zero as horizon grows, and should sit BELOW
-- order-sourced actual invoicing -- roughly RM2.6M/month in 2026 (RM3.5M total
-- x the ~73% that comes from orders). Both are correct: the model sees only
-- business already won.
--
-- THIS IS THE RE-RUN THAT MATTERS. The first version returned RM4.08M at
-- horizon 1 -- about 60% ABOVE reality -- because survivorship bias was
-- inflating every factor. On link ratios it should now come in at or below
-- ~RM2.6M. If it is still above, the link ratios are not falling with age the
-- way A1 expects, and the cause is upstream in the development view.
-- ############################################################################
select period_month,
       horizon,
       round(predicted)              as predicted_myr,
       orders_contributing,
       round(exposed_myr)            as exposed_myr,
       round(sqrt(variance))         as sd_myr
from public.v_sales_model_chainladder
order by horizon;


-- ############################################################################
-- A7 -- How much of the book did the model's guards discard?
--
-- Compares total remaining value against what actually reached the model at
-- horizon 1. The difference is value removed by the MAX_AGE cut-off and the
-- min_undeveloped floor. A large gap is not necessarily wrong -- dead orders
-- SHOULD be excluded -- but it must be a deliberate, visible number.
-- ############################################################################
select round((select sum(remaining_myr) from public.v_sales_orderbook_open))
                                                        as total_book_myr,
       round((select sum(remaining_myr) from public.v_sales_orderbook_open
              where age_months <= 24))                   as within_age_cap_myr,
       round((select exposed_myr from public.v_sales_model_chainladder
              where horizon = 1))                        as reached_model_myr;


-- ############################################################################
-- A8 -- ★ coverage(h): the blend weight ★
--
-- The number §6 uses to decide how much to trust the order book at each
-- horizon.
--
-- EXPECT: coverage at h=1 near 0.60 (Q3 measured ~60% on a 2023+ window; this
-- uses trailing 36 months), decaying steadily toward ~0 by h=8-12.
--
-- WATCH coverage_stddev. If it is large relative to coverage, the share
-- knowable in advance swings wildly month to month, and the blend weight is
-- itself uncertain -- which should widen the interval, not be averaged away.
--
-- If coverage at h=1 comes back far from 0.60, stop and reconcile against Q3
-- before building the ensemble on it.
-- ############################################################################
select horizon,
       months_observed,
       round(coverage::numeric, 4)                 as coverage,
       round(coverage_mean_of_months::numeric, 4)  as mean_of_months,
       round(coverage_stddev::numeric, 4)          as stddev,
       round(coverage_min::numeric, 3)             as min_month,
       round(coverage_max::numeric, 3)             as max_month
from public.v_sales_coverage_by_horizon
order by horizon;


-- ############################################################################
-- A9 -- ★ CHAIN-LADDER BIAS, MEASURED ★
--
-- The question A6 could not answer: is the model systematically wrong, or does
-- it only look wrong right now?
--
-- bias_pct is (predicted - actual) / actual against target_known_orders -- the
-- fair comparison, counting only invoicing from orders the model could see at
-- the origin. Positive means over-predicting.
--
-- HOW TO READ IT:
--
--   bias_pct roughly flat across horizons, around +70%
--      -> a consistent structural over-statement. Correctable with a measured
--         scaling factor, and the model stays a strong ensemble input.
--
--   bias_pct small at older origins, large at recent ones
--      -> the model is RIGHT and the order book genuinely stopped converting.
--         That is real signal about the business, not a modelling defect, and
--         the ensemble should keep it rather than scale it away.
--
--   bias_pct large and erratic
--      -> the development curve does not describe this book at all, and the
--         chain-ladder should carry little weight regardless of horizon.
-- ############################################################################
select horizon,
       count(*)                                                  as origins,
       round(avg(predicted))                                     as avg_predicted,
       round(avg(target_known_orders))                           as avg_actual_known,
       round(avg(error_vs_known))                                as avg_error,
       round(100.0 * sum(error_vs_known)
             / nullif(sum(target_known_orders), 0), 1)           as bias_pct,
       round(avg(abs(error_vs_known)))                           as mae,
       round(100.0 * count(*) filter (where error_vs_known > 0)
             / nullif(count(*), 0), 0)                           as pct_months_over
from public.v_sales_chainladder_backtest
group by horizon
order by horizon;


-- ############################################################################
-- A10 -- Is the bias stable over time, or is it recent?
--
-- Horizon 1 only, by origin month. This separates the two diagnoses in A9.
--
-- WATCH: if bias_pct is modest through 2024-2025 and blows out in 2026, the
-- model did not break -- the order book did. That would corroborate Q6 (90.6%
-- of the book overdue) and the ~RM1M/month of unconverted value accumulating,
-- and it would mean the honest fix is to surface the backlog rather than to
-- scale the forecast down.
-- ############################################################################
select origin_month,
       round(predicted)                                          as predicted,
       round(target_known_orders)                                as actual_known,
       round(error_vs_known)                                     as error,
       round(100.0 * error_vs_known
             / nullif(target_known_orders, 0), 1)                as bias_pct
from public.v_sales_chainladder_backtest
where horizon = 1
order by origin_month;


-- ############################################################################
-- A11 -- How much of each month can the order book never explain?
--
-- Decomposes the target month three ways:
--
--   known_pct  from orders placed on or before the origin -- the model's turf
--   later_pct  from orders placed AFTER the origin -- unknowable at the time
--   none_pct   from invoices with no sales order at all
--
-- known_pct is coverage(h) measured a second way, independently of
-- v_sales_coverage_by_horizon. The two should broadly agree -- A8 reported
-- 63.1% at h=1. If they disagree materially, one of them is wrong and the
-- blend weight cannot be trusted until that is resolved.
--
-- later_pct + none_pct is the share §6's a-priori has to carry.
-- ############################################################################
select horizon,
       round(100.0 * sum(target_known_orders)
             / nullif(sum(target_total), 0), 1)                  as known_pct,
       round(100.0 * sum(target_order_sourced - target_known_orders)
             / nullif(sum(target_total), 0), 1)                  as later_pct,
       round(100.0 * sum(target_total - target_order_sourced)
             / nullif(sum(target_total), 0), 1)                  as none_pct,
       round(avg(target_total))                                  as avg_month_myr
from public.v_sales_chainladder_backtest
group by horizon
order by horizon;
