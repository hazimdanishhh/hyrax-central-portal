-- ############################################################################
-- SALES PROJECTIONS -- STEP 3 VERIFICATION & STEP 4 GATE
--
-- Read-only. Every query here is a SELECT; nothing is created or modified.
--
-- HOW TO RUN
--
-- One query at a time. Each is numbered, self-contained, and separated by a
-- banner. Highlight a single block, run it, and keep the output -- these are
-- the evidence for the Step 4 go/no-go decision.
--
-- PREREQUISITE: the four view files must already have been run successfully,
-- in this order:
--     1. sql_editor/sales_projection_series_view.sql
--     2. sql_editor/sales_projection_decomposition_view.sql
--     3. sql_editor/sales_projection_baseline_view.sql
--     4. sql_editor/sales_projection_backtest_view.sql
--
-- If a query errors with `relation ... does not exist`, the corresponding view
-- file did not actually succeed -- go back and run that file on its own, with
-- nothing else selected, and read its error.
--
-- V1-V2 check the series. V3-V4 check the decomposition. V5-V6 check the
-- baselines. V7-V9 are the Step 4 gate itself.
-- ############################################################################


-- ############################################################################
-- V1 -- Series shape
--
-- Expect: 3 measures, 108+ months each, NO GAPS (months must equal
-- months_in_span), exactly one incomplete month per measure (the current one).
-- total_myr should match architecture doc §11 block 1.
--
-- If months < months_in_span the spine is broken, and every lag(value, 12)
-- downstream is silently counting the wrong rows.
-- ############################################################################
select measure,
       count(*)                                          as months,
       ( (extract(year  from max(period_month)) - extract(year  from min(period_month))) * 12
       + (extract(month from max(period_month)) - extract(month from min(period_month))) )::int + 1
                                                         as months_in_span,
       count(*) filter (where is_complete)               as complete_months,
       min(period_month)                                 as first_month,
       max(period_month)                                 as last_month,
       count(*) filter (where value = 0 and is_complete) as zero_months,
       round(sum(value) filter (where is_complete))      as total_myr,
       sum(doc_count) filter (where is_complete)         as total_docs
from public.v_sales_monthly_series
group by measure
order by measure;


-- ############################################################################
-- V2 -- Series tail, invoiced
--
-- Eyeball the last 18 months against Phase 0's block 1b. The final row is the
-- current partial month and must show is_complete = false.
-- ############################################################################
select period_month,
       round(value) as value_myr,
       doc_count,
       is_complete
from public.v_sales_monthly_series
where measure = 'invoiced'
order by period_month desc
limit 18;


-- ############################################################################
-- V3 -- Seasonal index normalisation
--
-- mean_index_must_be_1 has to read 1.0000 for every measure. Anything else
-- means the normalisation is broken and every projection built on it carries
-- a silent level bias.
-- ############################################################################
select measure,
       count(*)                      as months,
       round(avg(seasonal_index), 4) as mean_index_must_be_1,
       round(min(seasonal_index), 3) as min_index,
       round(max(seasonal_index), 3) as max_index
from public.v_sales_seasonal_index
group by measure
order by measure;


-- ############################################################################
-- V4 -- Seasonal shape, invoiced
--
-- The real, DETRENDED measurement -- Phase 0 block 4 was raw and
-- un-detrended, so expect different numbers, but the same SHAPE:
-- April lowest, March second-highest (the April-March fiscal-year effect).
--
-- If that shape has vanished once detrended, the "seasonality" in Phase 0 was
-- trend leakage and Engine A has much less to work with than it appeared.
--
-- ratio_stddev is how stable each month's index is across years. A month with
-- a high stddev contributes an index you should not lean on.
-- ############################################################################
select calendar_month,
       month_name,
       years_observed,
       round(seasonal_index, 3) as seasonal_index,
       round(ratio_stddev, 3)   as ratio_stddev
from public.v_sales_seasonal_index
where measure = 'invoiced'
order by calendar_month;


-- ############################################################################
-- V5 -- Baseline coverage
--
-- Six methods x two horizons. Row counts differ by design: each method is
-- null until its window fills, so seasonal_naive (needs 12 months) should
-- have the most rows and seasonal_naive_drift (needs 24-26) the fewest.
--
-- A method with ZERO rows means its branch is always null -- a real bug.
-- ############################################################################
select method,
       horizon,
       count(*)          as predictions,
       min(period_month) as first_target,
       max(period_month) as last_target
from public.v_sales_projection_baseline
where measure = 'invoiced'
group by method, horizon
order by method, horizon;


-- ############################################################################
-- V6 -- seasonal_naive correctness check
--
-- must_be_zero has to be 0 on EVERY row. seasonal_naive is defined as "the
-- actual from exactly 12 months ago", so any non-zero means lag() is counting
-- the wrong rows -- which would mean the spine in v_sales_monthly_series has
-- a gap, and every other method is quietly wrong too.
--
-- This is the single most important correctness check in the whole step.
-- ############################################################################
select b.period_month,
       round(b.predicted)           as predicted,
       round(s.value)               as actual_12m_ago,
       round(b.predicted - s.value) as must_be_zero
from public.v_sales_projection_baseline b
join public.v_sales_monthly_series s
  on s.measure = b.measure
 and s.period_month = (b.period_month - interval '12 months')::date
where b.measure = 'invoiced'
  and b.method  = 'seasonal_naive'
  and b.horizon = 1
order by b.period_month desc
limit 12;


-- ############################################################################
-- V7 -- ★ THE STEP 4 GATE ★  invoiced, horizon 1
--
-- This is the table the decision rests on. Paste the output into
-- SALES-PROJECTIONS-ARCHITECTURE.md §11.
--
-- Read it in this order:
--
--   1. is_publishable -- requires MASE < 1 AND beating seasonal_naive_drift.
--      The drift-adjusted comparator is the one to believe: plain
--      seasonal-naive repeats last year into a market down 36%, so beating it
--      proves almost nothing.
--
--   2. bias_pct and pct_months_over -- read these ALONGSIDE mase, not after.
--      A method can win on error size while over-predicting 90% of months,
--      and on a dashboard that reads as "about to miss target", permanently.
--
--   3. origins -- fewer than 12 and the result is not trustworthy regardless
--      of how good it looks.
--
-- If NOTHING shows is_publishable = true, the correct outcome is to ship
-- seasonal_naive and stop. That is a successful Step 4, not a failure.
-- ############################################################################
select method,
       origins,
       round(mae)               as mae_myr,
       round(mase, 3)           as mase,
       round(mean_pct_error, 1) as bias_pct,
       round(pct_over, 0)       as pct_months_over,
       mase_under_1,
       beats_naive,
       beats_naive_drift,
       is_publishable
from public.v_sales_projection_backtest
where measure = 'invoiced'
  and horizon = 1
order by mase;


-- ############################################################################
-- V8 -- Horizon 3: does accuracy survive distance?
--
-- Everything should degrade. The question is whether the RANKING holds. A
-- method that wins at horizon 1 and collapses at horizon 3 is not usable for
-- a 12-month forward chart.
-- ############################################################################
select method,
       origins,
       round(mae)               as mae_myr,
       round(mase, 3)           as mase,
       round(mean_pct_error, 1) as bias_pct,
       is_publishable
from public.v_sales_projection_backtest
where measure = 'invoiced'
  and horizon = 3
order by mase;


-- ############################################################################
-- V9 -- Best method per measure, horizon 1
--
-- orders and collected are not pilot measures, but a method that wins on all
-- three is substantially more trustworthy than one that only wins on
-- invoiced. Disagreement here is a reason to be cautious, not a blocker.
-- ############################################################################
select distinct on (measure)
       measure,
       method,
       origins,
       round(mase, 3)           as mase,
       round(mean_pct_error, 1) as bias_pct,
       is_publishable
from public.v_sales_projection_backtest
where horizon = 1
order by measure, mase;
