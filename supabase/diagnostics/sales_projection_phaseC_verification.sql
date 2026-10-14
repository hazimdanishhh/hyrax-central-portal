-- ############################################################################
-- SALES PROJECTIONS -- PHASE C VERIFICATION
--
-- Read-only. Run ONE BLOCK AT A TIME and keep each output.
--
-- PREREQUISITE -- run in THIS ORDER, each on its own.
-- sales_projection_baseline_view.sql opens with `drop view ... cascade`, which
-- also drops v_sales_projection_backtest and v_sales_model_baseline. Both must
-- be recreated afterwards or later steps fail with 42P01.
--
--     1. sql_editor/sales_projection_baseline_view.sql     (SES added)
--          ^ its CASCADE drops 2 and 3
--     2. sql_editor/sales_projection_backtest_view.sql     (recreate)
--     3. sql_editor/sales_model_baseline_view.sql          (recreate)
--     4. sql_editor/sales_model_ses_view.sql               (new)
--     5. sql_editor/sales_projection_calibration_view.sql  (new)
--     6. sql_editor/sales_projection_ensemble_view.sql     (new, needs 1-5)
--
-- C1 IS A GATE. Run it and read it before trusting anything after it -- it
-- decides whether the Phase B model ranking describes the business we are
-- actually forecasting.
-- ############################################################################


-- ############################################################################
-- C1 -- ★ THE REGIME SPLIT ★
--
-- Every method scored twice: over all origins, and over the last 24 only.
--
-- WHY THIS IS THE MOST IMPORTANT BLOCK IN PHASE C
--
-- Phase B elected a 24-month mean on the strength of 106 origins. But revenue
-- fell 36% year on year, and projecting that winner forward gives RM5.69M for
-- November against a trailing three-month actual of RM3.11M. The full-sample
-- ranking may be describing a business that no longer exists.
--
-- HOW TO READ IT:
--
--   rank_all and rank_recent broadly agree
--       -> the ranking is regime-independent. Use it, and the Phase B result
--          stands.
--
--   they disagree, and a shorter-memory method (ses_0XX, ma3) rises in
--   rank_recent
--       -> confirms the lag diagnosis. Weights and calibration both come from
--          the recent window, which is what the ensemble is built to do.
--
--   mae_recent is far larger than mae_all for EVERY method
--       -> the recent period is simply harder, not merely different. Intervals
--          must widen rather than the model being re-picked.
-- ############################################################################
with bound as (
    select (date_trunc('month', current_date) - interval '24 months')::date as cutoff
),
scored as (
    select b.method,
           b.horizon,
           avg(abs(b.predicted - b.actual))                             as mae_all,
           avg(abs(b.predicted - b.actual)) filter (where b.period_month >= bd.cutoff)
                                                                        as mae_recent,
           sum(b.predicted - b.actual) / nullif(sum(b.actual), 0) * 100 as bias_all,
           sum(b.predicted - b.actual) filter (where b.period_month >= bd.cutoff)
             / nullif(sum(b.actual) filter (where b.period_month >= bd.cutoff), 0) * 100
                                                                        as bias_recent,
           count(*) filter (where b.period_month >= bd.cutoff)          as origins_recent
    from public.v_sales_projection_baseline b
    cross join bound bd
    where b.measure = 'invoiced' and b.actual is not null
    group by b.method, b.horizon
)
select horizon,
       method,
       round(mae_all)                                                    as mae_all,
       round(mae_recent)                                                 as mae_recent,
       rank() over (partition by horizon order by mae_all)               as rank_all,
       rank() over (partition by horizon order by mae_recent)            as rank_recent,
       round(bias_all::numeric, 1)                                       as bias_all_pct,
       round(bias_recent::numeric, 1)                                    as bias_recent_pct,
       origins_recent
from scored
where horizon = 1
order by mae_recent;


-- ############################################################################
-- C2 -- The fitted alpha
--
-- Which exponential-smoothing alpha actually won, by horizon, and how it
-- compares against the trailing means it is meant to replace.
--
-- WATCH: if the winner is pinned at 0.5 -- the top of the grid -- the data
-- wants to react even faster and the grid should be extended in
-- sales_projection_baseline_view.sql. If it is pinned at 0.1, SES is
-- converging on a long mean and adds little over ma12.
--
-- A mid-grid winner (0.2-0.4) is the useful outcome: it means there is a real
-- optimum between "trust recent months" and "trust history", and the data
-- found it rather than us guessing.
-- ############################################################################
with bound as (
    select (date_trunc('month', current_date) - interval '24 months')::date as cutoff
)
select b.horizon,
       b.method,
       count(*)                                                       as origins,
       round(avg(abs(b.predicted - b.actual)))                        as mae_recent,
       round(sum(b.predicted - b.actual)
             / nullif(sum(b.actual), 0) * 100, 1)                     as bias_recent_pct
from public.v_sales_projection_baseline b
cross join bound bd
where b.measure = 'invoiced'
  and b.actual is not null
  and b.period_month >= bd.cutoff
  and (b.method like 'ses\_%' or b.method in ('ma3', 'ma12', 'freqsev'))
group by b.horizon, b.method
order by b.horizon, mae_recent;


-- ############################################################################
-- C3 -- Calibration factors, and the size of the regime effect
--
-- `regime_gap` is bias_recent minus bias_all. A large positive value means the
-- model is running much hotter now than its full history suggests -- which is
-- precisely the lag that started Phase C.
--
-- WATCH: `basis` should read 'recent' for everything. 'full history' means
-- that model/horizon had fewer than six recent origins and fell back, and its
-- calibration will not reflect the current regime.
-- ############################################################################
select model,
       horizon,
       origins_recent,
       round(bias_all::numeric * 100, 1)     as bias_all_pct,
       round(bias_recent::numeric * 100, 1)  as bias_recent_pct,
       round(regime_gap::numeric * 100, 1)   as regime_gap_pct,
       basis,
       round(factor::numeric, 3)             as divide_by
from public.v_sales_projection_calibration
where horizon in (1, 3, 6, 12)
order by horizon, model;


-- ############################################################################
-- C4 -- SES forward view agrees with its backward twin
--
-- The forward view recomputes the same closed form over the same series, so at
-- the chosen alpha the two must land in the same place. A material gap means
-- the weight index or the normalisation differs between the files.
--
-- `alpha` here is what the forward view selected; compare against C2's winner
-- at the same horizon -- they must match, since both pick lowest recent MAE.
-- ############################################################################
select s.horizon,
       round(s.alpha, 2)        as chosen_alpha,
       s.alpha_origins,
       round(s.predicted)       as forward_level,
       round(sqrt(s.variance))  as implied_mae
from public.v_sales_model_ses s
order by s.horizon;


-- ############################################################################
-- C5 -- Blend arithmetic reconciles
--
-- projected must equal cl_contribution + (1 - coverage) x implied_from_apriori
-- exactly. A mismatch means the implied/weighting algebra in the ensemble view
-- does not agree with the Bornhuetter-Ferguson formula it claims to implement.
--
-- Also confirms the blend sits BETWEEN its two inputs -- a blend outside the
-- range of its components is arithmetically impossible and would indicate a
-- sign or weighting error.
-- ############################################################################
-- ⚠ CORRECTED 2026-10-03. This recomputation used `coverage` as the blend
-- weight, which is what the view did until C17/C20 replaced it with the
-- measured `order_book_weight`. The check was therefore testing the OLD
-- formula against the NEW view and reporting a mismatch at every horizon
-- (h=1: blend 4,140,562 vs recomputed 5,373,313) that was entirely the
-- diagnostic's fault. coverage still SCALES the chain-ladder to a full month;
-- it is no longer the weight.
select horizon,
       round(coverage::numeric, 3)                       as coverage,
       round(order_book_weight::numeric, 3)              as order_book_weight,
       round(implied_from_order_book)                    as order_book_implied,
       round(implied_from_apriori)                       as apriori_implied,
       round(projected)                                  as blend,
       round(order_book_weight * implied_from_order_book
             + (1 - order_book_weight) * implied_from_apriori)
                                                         as recomputed_must_match,
       case
         when projected between
              least(implied_from_order_book, implied_from_apriori) - 1
          and greatest(implied_from_order_book, implied_from_apriori) + 1
         then 'between its inputs -- ok'
         else 'OUTSIDE its inputs -- ERROR'
       end                                               as sanity
from public.v_sales_projection_ensemble
order by horizon;


-- ############################################################################
-- C6 -- ★ SANITY AGAINST REALITY ★
--
-- The check that started Phase C. Before calibration the blend read RM5.69M
-- for November against a trailing three-month actual of RM3.11M -- 83% high.
--
-- This is not a formal statistic. It is the question anyone looking at the
-- dashboard will ask in the first five seconds: does this number look like
-- the business?
--
-- EXPECT the h=1 blend to sit near, or modestly above, the recent run rate.
-- Modestly above is defensible -- the order book is genuinely fuller than
-- recent invoicing. 80% above is not.
-- ############################################################################
with recent as (
    select avg(value) as avg_3m
    from (
        select value from public.v_sales_monthly_series
        where measure = 'invoiced' and is_complete
        order by period_month desc limit 3
    ) q
),
recent6 as (
    select avg(value) as avg_6m
    from (
        select value from public.v_sales_monthly_series
        where measure = 'invoiced' and is_complete
        order by period_month desc limit 6
    ) q
)
select e.horizon,
       e.period_month,
       round(e.projected)                                        as projected,
       round(r.avg_3m)                                           as trailing_3m_actual,
       round(r6.avg_6m)                                          as trailing_6m_actual,
       round(100.0 * e.projected / nullif(r.avg_3m, 0) - 100, 0) as pct_vs_3m,
       round(e.lo_80)                                            as lo_80,
       round(e.hi_80)                                            as hi_80
from public.v_sales_projection_ensemble e
cross join recent r
cross join recent6 r6
where e.horizon in (1, 2, 3, 6, 12)
order by e.horizon;


-- ############################################################################
-- C7 -- Interval shape and the sources of uncertainty
--
-- WATCH THREE THINGS:
--
--   1. The interval must be ASYMMETRIC -- upside_80 larger than downside_80.
--      Symmetric means the lognormal transform is not applying.
--
--   2. between_var should GROW relative to within_var as horizon rises. Far
--      out, the models genuinely disagree more; that is the honest reason the
--      fan widens, not an assumption that the future is murkier.
--
--   3. lo_80 must stay comfortably above zero. A lower bound near zero means
--      the variance is too large for the mean and the band is useless.
-- ############################################################################
select horizon,
       round(projected)                                             as projected,
       round(sd)                                                    as sd,
       round(lo_80)                                                 as lo_80,
       round(hi_80)                                                 as hi_80,
       round(hi_80 - projected)                                     as upside_80,
       round(projected - lo_80)                                     as downside_80,
       round(100.0 * within_var / nullif(within_var + between_var, 0), 0)
                                                                    as pct_within,
       round(100.0 * between_var / nullif(within_var + between_var, 0), 0)
                                                                    as pct_between
from public.v_sales_projection_ensemble
order by horizon;


-- ############################################################################
-- ############################################################################
-- RE-RUN C3, C5, C6 AND C7 AFTER THE 2026-10-02 FIXES
--
-- Two bugs were found by reading C5 and C7 together, and both are fixed:
--
--   1. sales_projection_calibration_view.sql -- `combined` unioned two CTEs
--      with `select *`. UNION ALL matches by POSITION, and the expansion CTE
--      added in the previous pass listed origins_recent and bias_all in the
--      opposite order to the source CTEs. The chain-ladder rows therefore took
--      an origin COUNT into bias_all, giving factor = 1 + 24 = 25 instead of
--      1.108. The order book was divided down to RM292,159 against a RM4.45M
--      raw prediction, and the h=1 blend read 46% BELOW the trailing 3 months.
--
--   2. sales_projection_ensemble_view.sql -- the calibration join matched the
--      FORWARD model names (baseline, freqsev, ses) against the calibration
--      view's SCORING method names (ma12, freqsev, ses_0XX). Only freqsev
--      matched; the other two silently took factor = 1. C5's apriori_implied
--      of RM4,124,315 is the plain average of the three RAW forwards, which is
--      what gave it away.
--
-- Re-run, in this order:
--     1. sql_editor/sales_projection_calibration_view.sql
--     2. sql_editor/sales_projection_ensemble_view.sql
-- then C3, C5, C6, C7 again, plus C8 and C9 below.
--
-- EXPECT THE h=1 BLEND TO RISE SHARPLY. The -46% was not a correct model; it
-- was an accidental division by 25. Fixing it restores the ORIGINAL problem --
-- a blend well above the recent run rate -- which C8 and C9 exist to diagnose.
-- ############################################################################


-- ############################################################################
-- C8 -- ★ IS THE CHAIN-LADDER'S FORWARD NUMBER EVEN POSSIBLE? ★
--
-- The chain-ladder predicts only the part of next month that traces to orders
-- ALREADY on the book. Coverage says that part is 63% of the month. So its
-- prediction must come out WELL BELOW a whole typical month.
--
-- It does not. It reads RM4.45M against a trailing three-month actual of
-- RM3.16M for the ENTIRE month. A 63% share cannot exceed the whole.
--
-- This block scores the chain-ladder backtest honestly at h=1, origin by
-- origin, over the last 18 origins -- against the known-order revenue it is
-- meant to predict AND against total invoicing.
--
-- HOW TO READ IT:
--
--   bias_vs_known is small but avg_predicted is close to avg_target_total
--       -> the model is accurate on its own terms, and `known orders` has
--          itself grown to be nearly the whole month. Coverage(h) is then the
--          number that is wrong, not the chain-ladder.
--
--   bias_vs_known is large and positive in the RECENT rows only
--       -> the development pattern no longer holds. Orders are not converting
--          the way they did, which matches the 90.6%-overdue book. The
--          calibration window is then too long and must shorten.
--
--   known_share_of_total is far below coverage(h) = 63%
--       -> the two views disagree about what the order book covers, and the
--          blend is double-counting. That is a wiring defect, not a modelling
--          one.
-- ############################################################################
select c.origin_month,
       round(c.predicted)                                           as predicted,
       round(c.target_known_orders)                                 as actual_known,
       round(c.target_total)                                        as actual_total,
       round(100.0 * c.predicted / nullif(c.target_known_orders, 0) - 100, 1)
                                                                    as err_vs_known_pct,
       round(100.0 * c.predicted / nullif(c.target_total, 0) - 100, 1)
                                                                    as err_vs_total_pct,
       round(100.0 * c.target_known_orders / nullif(c.target_total, 0), 1)
                                                                    as known_share_of_total_pct
from public.v_sales_chainladder_backtest c
where c.horizon = 1
order by c.origin_month desc
limit 18;


-- ############################################################################
-- C9 -- Can the open book physically deliver RM4.45M next month?
--
-- The chain-ladder applies development factors fitted on history to whatever
-- is open today. If today's book is mostly STALE -- orders long past their
-- delivery date that are not converting -- those factors are being applied to
-- value that will never arrive, and the model over-predicts no matter how well
-- it backtests.
--
-- §4 of the roadmap measured the book at 90.6% overdue with roughly RM1M a
-- month accumulating unconverted. This block puts a number on how much of the
-- remaining value is genuinely live.
--
-- WATCH: compare `remaining_myr` in the 0-3 month ages against the RM4.45M the
-- chain-ladder expects next month. If the fresh book is a fraction of that, the
-- prediction is leaning on stale value and the development factors must be
-- fitted on age-banded cohorts rather than the book as a whole.
-- ############################################################################
select case
         when age_months <= 3  then 'a. 0-3 months'
         when age_months <= 6  then 'b. 4-6 months'
         when age_months <= 12 then 'c. 7-12 months'
         when age_months <= 24 then 'd. 13-24 months'
         else                       'e. over 24 months'
       end                                              as age_band,
       count(*)                                         as open_lines,
       round(sum(remaining_myr))                        as remaining_myr,
       round(100.0 * sum(remaining_myr)
             / nullif(sum(sum(remaining_myr)) over (), 0), 1)
                                                        as pct_of_open_value
from public.v_sales_orderbook_open
where remaining_myr > 0
group by 1
order by 1;


-- ############################################################################
-- C10 -- ★ WHERE DOES THE RM4.45M ACTUALLY COME FROM? ★
--
-- C6 shows the h=1 blend at RM5.39M against a RM3.16M trailing actual, and C5
-- shows essentially all of the excess sitting on the order-book side: the
-- chain-ladder implies RM6.33M for the full month while the a-priori models
-- imply RM3.78M. The error also tracks coverage(h) almost exactly -- +71% at
-- h=1 where coverage is 63%, +16% at h=12 where it is 3% -- which is the
-- signature of the chain-ladder, not the a-priori side.
--
-- So: which orders are generating that number?
--
-- This repeats the exposure arithmetic from sales_model_chainladder_view.sql
-- at h=1 exactly (where survival = 1 by construction, so the prediction is
-- simply remaining_myr x link_rate at the order's current age) and splits it
-- by how old the order is.
--
-- HOW TO READ IT:
--
--   Most of the prediction comes from the 0-3 month band
--       -> the model is behaving. The book genuinely grew, and the forecast is
--          reporting real committed business. The problem is then that the
--          BOOK is not converting, which is a business fact the dashboard
--          should show rather than a defect to smooth away.
--
--   A large share comes from the 13-24 month band
--       -> link ratios fitted on healthy cohorts are being applied to orders
--          that have already failed to convert for a year. That value is
--          largely phantom and max_age_months must come down.
--
--   implied_rate_pct is high in the OLD bands
--       -> the development curve has not decayed enough with age; the link
--          ratio at 18 months should be near zero and is not.
-- ############################################################################
with params as (
    select 24 as max_age_months
),
dev as materialized (
    select age_months,
           link_rate,
           coalesce(
               sum(survival_log) over (
                   order by age_months
                   rows between unbounded preceding and 1 preceding
               ), 0
           ) as cum_log_before
    from public.v_sales_order_development
),
exposure as (
    select ob.age_months,
           ob.remaining_myr,
           d_now.link_rate as rate_at_conversion
    from public.v_sales_orderbook_open ob
    cross join params p
    join dev d_now on d_now.age_months = ob.age_months
    where ob.age_months between 0 and p.max_age_months
      and ob.remaining_myr > 0
)
select case
         when age_months <= 3  then 'a. 0-3 months'
         when age_months <= 6  then 'b. 4-6 months'
         when age_months <= 12 then 'c. 7-12 months'
         else                       'd. 13-24 months'
       end                                                        as age_band,
       count(*)                                                   as open_lines,
       round(sum(remaining_myr))                                  as exposed_myr,
       round(sum(remaining_myr * rate_at_conversion))             as predicted_h1_myr,
       round(100.0 * sum(remaining_myr * rate_at_conversion)
             / nullif(sum(sum(remaining_myr * rate_at_conversion)) over (), 0), 1)
                                                                  as pct_of_prediction,
       round(100.0 * sum(remaining_myr * rate_at_conversion)
             / nullif(sum(remaining_myr), 0), 1)                  as implied_rate_pct
from exposure
group by 1
order by 1;


-- ############################################################################
-- C11 -- Is the order book growing because of sales, or because of non-delivery?
--
-- The chain-ladder's forward prediction is RM4.45M. Its own in-sample
-- predictions over the last twelve origins averaged RM2.58M (C8). Today's book
-- is therefore producing a far bigger number than the book did at any recent
-- origin -- and there are only two explanations.
--
--   Orders came IN faster recently
--       -> real. There is committed business waiting, invoicing should follow,
--          and the projection is doing its job by seeing it before the
--          trailing means do.
--
--   Orders came in at the same rate but stopped being INVOICED
--       -> the book is inflating with work that is not converting. The
--          chain-ladder reads accumulation as future revenue, and the gap
--          between the two lines below IS the RM1M/month overhang already
--          recorded in docs/portal/DASHBOARD-ROADMAP.md §4.
--
-- WATCH the `cumulative_gap_myr` column -- orders minus invoicing, running.
-- A steadily rising figure is the second explanation, and it means the
-- chain-ladder must be capped by something other than its own link ratios.
-- ############################################################################
with m as (
    select period_month,
           max(value) filter (where measure = 'orders')   as ordered_myr,
           max(value) filter (where measure = 'invoiced') as invoiced_myr
    from public.v_sales_monthly_series
    where is_complete
    group by period_month
)
select period_month,
       round(ordered_myr)                                          as ordered_myr,
       round(invoiced_myr)                                         as invoiced_myr,
       round(ordered_myr - invoiced_myr)                           as gap_myr,
       round(sum(ordered_myr - invoiced_myr) over (order by period_month))
                                                                   as cumulative_gap_myr,
       round(100.0 * invoiced_myr / nullif(ordered_myr, 0), 1)     as invoiced_pct_of_ordered
from m
order by period_month desc
limit 18;


-- ############################################################################
-- ############################################################################
-- C12-C14 -- THE PHASE C GATE
--
-- Run sql_editor/sales_projection_ensemble_backtest_view.sql first. It depends
-- on sales_projection_baseline_view.sql and sales_chainladder_backtest_view.sql
-- and may take a while: it rebuilds the blend at roughly a hundred origins,
-- four times over, with point-in-time calibration at each one.
--
-- Read C12 BEFORE C13. C12 picks the calibration window; C13 is then read at
-- the window C12 chose.
-- ############################################################################


-- ############################################################################
-- C12 -- ★ HOW LONG SHOULD THE CALIBRATION WINDOW BE? ★
--
-- C8 showed the chain-ladder bias flipping sign inside the current 24-month
-- window: under-predicting through the 2025 backlog burn-down, over-predicting
-- through the 2026 slowdown, and reporting a harmless-looking +10.8% that is
-- correct for neither half. So 24 months is wrong. The question is what to
-- replace it with, and the answer has to be measured rather than chosen.
--
-- Each window is scored over IDENTICAL origins -- the view drops any origin a
-- 24-month window could not reach, so a short window cannot win by quietly
-- forecasting an easier stretch of history.
--
-- HOW TO READ IT:
--
--   One window wins at h=1 AND h=3
--       -> take it. Those are the horizons the dashboard leads with and where
--          the chain-ladder carries most of the weight.
--
--   Short windows win near, long windows win far
--       -> expected, and fine. The window can vary by horizon, exactly as the
--          weights already do. Record both in 11g.
--
--   The differences are tiny (a few percent of MAE)
--       -> the window does not matter much and 12 months is the sensible
--          default on sample-size grounds. Say so rather than inventing a
--          preference.
--
--   bias_pct stays large and positive at every window
--       -> calibration is not the lever. The problem is in the development
--          factors themselves, not in correcting their output, and Phase C
--          needs a fifth block rather than a parameter.
-- ############################################################################
with s as (
    select window_months,
           horizon,
           count(*)                                        as origins,
           avg(abs(error))                                 as mae,
           sum(error) / nullif(sum(actual), 0) * 100       as bias_pct
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
    group by window_months, horizon
)
select horizon,
       window_months,
       origins,
       round(mae)                                                        as mae,
       round(bias_pct::numeric, 1)                                       as bias_pct,
       rank() over (partition by horizon order by mae)                   as rank_at_horizon,
       round(100.0 * (mae - min(mae) over (partition by horizon))
             / nullif(min(mae) over (partition by horizon), 0), 1)       as pct_worse_than_best
from s
where horizon in (1, 3, 6, 12)
order by horizon, mae;


-- ############################################################################
-- C13 -- ★★ THE GATE: DOES THE BLEND BEAT ITS OWN MEMBERS? ★★
--
-- Every estimator is expressed as a FULL-MONTH figure and scored against total
-- invoicing, so this is like for like. The chain-ladder is lifted by
-- coverage(h) for the comparison; without that it would lose for a reason that
-- has nothing to do with accuracy.
--
-- seasonal_naive is the floor. It is uncalibrated and simply repeats the same
-- month a year earlier. Anything that cannot beat it has earned nothing.
--
-- THE DECISION:
--
--   ensemble ranks 1st at h=1 and h=3
--       -> PASS. Ship the blend. Proceed to Phase D.
--
--   ensemble is mid-pack but within a few percent of the best single model
--       -> still ship it. An ensemble that ties its best member is worth more
--          than that member alone, because it does not depend on which model
--          happens to suit the next regime -- and C8 just demonstrated that
--          regimes turn over without warning.
--
--   one single model beats the ensemble clearly at both horizons
--       -> FAIL. Ship that model on its own, record the result in 11g, and
--          cut the blend out of Phase D rather than carrying machinery that
--          costs accuracy.
--
--   nothing beats seasonal_naive
--       -> stop. Publish no forward number and say why.
-- ############################################################################
with s as (
    select window_months,
           horizon,
           estimator,
           count(*)                                   as origins,
           avg(abs(error))                            as mae,
           sum(error) / nullif(sum(actual), 0) * 100  as bias_pct,
           100.0 * count(*) filter (where error > 0) / nullif(count(*), 0)
                                                      as pct_over
    from public.v_sales_projection_ensemble_backtest
    group by window_months, horizon, estimator
)
select horizon,
       window_months,
       estimator,
       origins,
       round(mae)                                                      as mae,
       round(bias_pct::numeric, 1)                                     as bias_pct,
       round(pct_over::numeric, 0)                                     as pct_months_over,
       rank() over (partition by horizon, window_months order by mae)  as rnk,
       round(100.0 * (mae - min(mae) over (partition by horizon, window_months))
             / nullif(min(mae) over (partition by horizon, window_months), 0), 1)
                                                                       as pct_worse_than_best
from s
where horizon in (1, 3, 6, 12)
order by horizon, window_months, mae;


-- ############################################################################
-- C14 -- ARE MULTI-MONTH TOTALS MORE ACCURATE THAN SINGLE MONTHS?
--
-- This decides which number LEADS the dashboard.
--
-- Monthly revenue is lumpy -- section 11 measured the top three invoices at
-- 31.2% of a typical month -- so a single month is largely a timing question:
-- did that one large shipment land in March or April? Over a quarter or a year
-- those timing errors cancel, and the total can be far more accurate than any
-- of its parts.
--
-- Errors are taken on the TOTAL, not averaged across months: a three-month
-- forecast is right if the three months sum correctly, even when each
-- individual month is off. That is why the backtest view emits origin-level
-- rows rather than a scorecard.
--
-- mae_pct_of_actual is the comparable figure -- absolute error as a share of
-- what actually arrived, so a 12-month span can be read against a 1-month one.
-- (MAPE per month is deliberately avoided throughout this project: it explodes
-- on small months and would flatter long spans for the wrong reason.)
--
-- HOW TO READ IT:
--
--   mae_pct_of_actual FALLS as span grows
--       -> totals are more reliable than months. The fiscal-year outlook
--          (Apr-Mar) leads the dashboard and the next-month tile is secondary,
--          labelled as the volatile figure it is.
--
--   it is flat or RISES
--       -> errors are compounding rather than cancelling, which means a
--          genuine level error rather than timing noise. Next month leads, and
--          the annual figure ships with a visibly wider band.
-- ############################################################################
with e as (
    select window_months, origin_month, horizon, predicted, actual
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
),
spans as (
    select unnest(array[1, 3, 6, 12]) as span
),
tot as (
    select e.window_months,
           e.origin_month,
           s.span,
           sum(e.predicted) as pred_total,
           sum(e.actual)    as act_total
    from e
    cross join spans s
    where e.horizon <= s.span
    group by e.window_months, e.origin_month, s.span
    having count(*) = s.span
)
select window_months,
       span                                                            as months_in_span,
       count(*)                                                        as origins,
       round(avg(act_total))                                           as avg_actual_total,
       round(avg(abs(pred_total - act_total)))                         as mae_total,
       round(100.0 * avg(abs(pred_total - act_total))
             / nullif(avg(act_total), 0), 1)                           as mae_pct_of_actual,
       round(100.0 * sum(pred_total - act_total)
             / nullif(sum(act_total), 0), 1)                           as bias_pct
from tot
group by window_months, span
order by window_months, span;


-- ############################################################################
-- C15 -- ★ VERIFY THE h=6 CHAIN-LADDER RESULT BEFORE BUILDING ON IT ★
--
-- C13 reports the chain-ladder as the WORST estimator at h=1 (MAE 2.39M, rank
-- 6 of 6) and at h=3 (2.24M, rank 6 of 6), then the BEST by a wide margin at
-- h=6 (0.95M, less than half the next model). A model does not normally get
-- dramatically more accurate as the forecast horizon lengthens. Either
-- something real and interesting is happening, or the h=6 figure is an
-- artefact -- and it rests on only 12 origins.
--
-- Two things could manufacture it:
--
--   1. The full-month lift. The chain-ladder is divided by coverage(h) to make
--      it comparable, and coverage(6) is 0.132 -- a 7.6x multiplication. If the
--      point-in-time factor also happened to be small, predictions could be
--      scaled into roughly the right range by coincidence rather than by
--      tracking anything.
--
--   2. The eligible window. Only 12 origins survive at h=6, covering a
--      particular stretch of 2025-2026. If the actuals there happen to be flat,
--      any near-constant prediction scores well.
--
-- WATCH: do predicted and actual move TOGETHER, month by month? If actual
-- swings from 2.1M to 9.4M (which C11 says it does) while predicted stays
-- nearly flat and still scores MAE 0.95M, the result is arithmetic, not skill.
-- ############################################################################
select horizon,
       origin_month,
       target_month,
       round(predicted)                                     as predicted,
       round(actual)                                        as actual,
       round(error)                                         as error,
       round(100.0 * predicted / nullif(actual, 0) - 100, 1) as err_pct
from public.v_sales_projection_ensemble_backtest
where estimator = 'chainladder'
  and window_months = 12
order by horizon, origin_month;


-- ############################################################################
-- C16 -- How much do the estimators actually disagree, month by month?
--
-- C13 shows the ensemble with the BEST bias almost everywhere (-2.8% at h=1,
-- against +10.1% for the model that beats it on MAE) and yet a WORSE absolute
-- error. That combination has a specific meaning: the members' errors are
-- correlated, so averaging them cancels the systematic over-prediction but
-- does not cancel the month-to-month noise, while the blend also drags in the
-- chain-ladder -- which coverage(h) hands 63% of the weight at h=1 despite it
-- ranking last.
--
-- This block puts the per-origin spread next to the actual, so the claim can
-- be checked rather than asserted.
--
-- WATCH: if every model misses in the SAME direction in the same month, an
-- ensemble cannot help on MAE and the honest move is to ship the best single
-- model. If they miss in different directions, the blend should be winning and
-- the weighting is what is wrong.
-- ############################################################################
select horizon,
       origin_month,
       round(max(actual))                                            as actual,
       round(min(predicted) filter (where estimator <> 'ensemble'))  as lowest_member,
       round(max(predicted) filter (where estimator <> 'ensemble'))  as highest_member,
       round(avg(predicted) filter (where estimator = 'ensemble'))   as ensemble,
       count(*) filter (where estimator <> 'ensemble' and error > 0) as members_over,
       count(*) filter (where estimator <> 'ensemble')               as members_total
from public.v_sales_projection_ensemble_backtest
where window_months = 12
  and horizon in (1, 3)
group by horizon, origin_month
order by horizon, origin_month;


-- ############################################################################
-- ############################################################################
-- C17-C19 -- THE GATE, SECOND RUN
--
-- C12, C13 and C14 above ran against the FIRST version of
-- v_sales_projection_ensemble_backtest, which fixed the order-book weight at
-- coverage(h) and could only see horizons 1, 3, 6 and 12. Their results stand
-- as evidence -- they are what overturned the Bornhuetter-Ferguson weighting --
-- but they are superseded as a decision. Read C17-C19 instead.
--
-- Two things changed underneath:
--
--   1. sales_projection_baseline_view.sql now scores EVERY horizon 1..12, not
--      four of them. C14 could not build a three-month total because there was
--      no h=2 to add, and h=12 could not be scored at all.
--
--   2. The order-book weight is now swept (0.0 to 1.0, plus coverage(h) as the
--      BF default) rather than assumed, because the first run measured the
--      chain-ladder as the WORST estimator at h=1 while BF handed it 63% of
--      the blend, and the BEST at h=6 on 13%.
--
-- RE-RUN ORDER -- each on its own. The first file CASCADEs.
--
--     1. sql_editor/sales_projection_baseline_view.sql        (all 12 horizons)
--          ^ its CASCADE drops ALL SIX below
--     2. sql_editor/sales_projection_backtest_view.sql
--     3. sql_editor/sales_model_baseline_view.sql
--     4. sql_editor/sales_model_ses_view.sql
--     5. sql_editor/sales_projection_calibration_view.sql
--     6. sql_editor/sales_projection_ensemble_view.sql
--     7. sql_editor/sales_projection_ensemble_backtest_view.sql
--
-- ⚠ CORRECTED 2026-10-03. An earlier version of this note listed only steps
-- 2-4 and said the calibration, SES and ensemble views merely "should" be
-- re-run. That was wrong: SIX views read v_sales_projection_baseline directly,
-- so the CASCADE DROPS them all. Skipping any of 4, 5 or 6 fails with
-- `42P01: relation ... does not exist` at the next step that needs it. The
-- full map lives in the banner at the top of
-- sql_editor/sales_projection_baseline_view.sql.
--
-- Steps 4-6 also CHANGE their output beyond simply being recreated: their
-- "borrow the nearest scored horizon" laterals now resolve to exact matches,
-- so the eight previously-approximated horizons move.
-- ############################################################################


-- ############################################################################
-- C17 -- ★★ HOW MUCH SHOULD THE ORDER BOOK COUNT, AT EACH HORIZON? ★★
--
-- The question the first run forced open. coverage(h) is in the grid as one
-- candidate, so the original design competes rather than being assumed or
-- discarded.
--
-- Shows the three best configurations per horizon, plus every coverage(h) row
-- so the Bornhuetter-Ferguson default can always be located and compared.
--
-- HOW TO READ IT:
--
--   The winning weight RISES with horizon
--       -> confirms C15 at the level of the whole blend: the order book is a
--          long-range signal here, not a short-range one, and BF is upside
--          down for this business. Record it in 11g with C15 as the evidence.
--
--   coverage(h) wins anywhere
--       -> the actuarial prior holds at that horizon. Keep it there and say so.
--
--   Weight 0.0 wins at h=1
--       -> the order book contributes nothing useful to next month, and the
--          near-term number is a pure statistical forecast. That is a
--          publishable finding, not a failure -- it says the book tells you
--          about the year, not the month.
--
--   Weight 1.0 wins anywhere
--       -> the blend collapses to the chain-ladder alone at that horizon. Check
--          it against C15 before believing it; at h=6 that is plausible, and
--          elsewhere it is probably a small-sample result.
-- ############################################################################
with ens as (
    select window_months,
           cl_weight_label,
           horizon,
           count(*)                                  as origins,
           avg(abs(error))                           as mae,
           sum(error) / nullif(sum(actual), 0) * 100 as bias_pct
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
    group by window_months, cl_weight_label, horizon
),
members as (
    select horizon,
           window_months,
           min(mae) as best_member_mae
    from (
        select window_months, horizon, estimator, avg(abs(error)) as mae
        from public.v_sales_projection_ensemble_backtest
        where estimator <> 'ensemble'
        group by window_months, horizon, estimator
    ) m
    group by horizon, window_months
),
ranked as (
    select e.*,
           m.best_member_mae,
           rank() over (partition by e.horizon order by e.mae) as rank_at_horizon
    from ens e
    join members m
      on m.horizon = e.horizon and m.window_months = e.window_months
)
select horizon,
       rank_at_horizon,
       cl_weight_label                                                   as order_book_weight,
       window_months                                                     as cal_window,
       origins,
       round(mae)                                                        as mae,
       round(bias_pct::numeric, 1)                                       as bias_pct,
       round(best_member_mae)                                            as best_member_mae,
       round(100.0 * (mae - best_member_mae)
             / nullif(best_member_mae, 0), 1)                            as pct_vs_best_member
from ranked
where horizon in (1, 3, 6, 12)
  and (rank_at_horizon <= 3 or cl_weight_label = 'coverage(h)')
order by horizon, rank_at_horizon;


-- ############################################################################
-- C18 -- ★★ THE GATE: BEST BLEND vs EVERY SINGLE MODEL ★★
--
-- Each estimator at its own best configuration, ranked together per horizon.
-- Every figure is a FULL-MONTH estimate scored against total invoicing, so the
-- comparison is like for like.
--
-- seasonal_naive is the floor: uncalibrated, repeats the same month a year
-- earlier. Anything that cannot beat it has earned nothing.
--
-- THE DECISION, per horizon:
--
--   ensemble ranks 1st
--       -> ship the blend at that horizon, with the window and order-book
--          weight C17 chose.
--
--   ensemble is within a few percent of the best single model
--       -> still ship it. A blend that ties its best member is worth more than
--          that member alone, because it does not depend on which model happens
--          to suit the next regime -- and C8 showed regimes turn over without
--          warning.
--
--   a single model beats the ensemble clearly
--       -> ship that model at that horizon and record it in 11g. Different
--          horizons choosing different models is a legitimate design, not a
--          failure: C15 already showed the chain-ladder is worst at h=1 and
--          best at h=6.
--
--   nothing beats seasonal_naive at a horizon
--       -> publish no number at that horizon and say why.
-- ############################################################################
with scored as (
    select estimator,
           horizon,
           window_months,
           cl_weight_label,
           count(*)                                   as origins,
           avg(abs(error))                            as mae,
           sum(error) / nullif(sum(actual), 0) * 100  as bias_pct,
           100.0 * count(*) filter (where error > 0)
             / nullif(count(*), 0)                    as pct_over
    from public.v_sales_projection_ensemble_backtest
    group by estimator, horizon, window_months, cl_weight_label
),
best_config as (
    select distinct on (horizon, estimator)
           horizon, estimator, window_months, cl_weight_label,
           origins, mae, bias_pct, pct_over
    from scored
    order by horizon, estimator, mae
)
select horizon,
       rank() over (partition by horizon order by mae)   as rnk,
       estimator,
       window_months                                     as cal_window,
       cl_weight_label                                   as order_book_weight,
       origins,
       round(mae)                                        as mae,
       round(bias_pct::numeric, 1)                       as bias_pct,
       round(pct_over::numeric, 0)                       as pct_months_over,
       round(100.0 * (mae - min(mae) over (partition by horizon))
             / nullif(min(mae) over (partition by horizon), 0), 1)
                                                         as pct_worse_than_best
from best_config
where horizon in (1, 3, 6, 12)
order by horizon, mae;


-- ############################################################################
-- C19 -- ARE MULTI-MONTH TOTALS MORE ACCURATE THAN SINGLE MONTHS?
--
-- Replaces C14, which could only ever return a one-month row: a three-month
-- span needs horizons 1, 2 and 3, and the scoring view only had 1, 3, 6 and 12.
-- It now has all twelve.
--
-- This decides which number LEADS the dashboard.
--
-- Monthly revenue is lumpy -- section 11 measured the top three invoices at
-- 31.2% of a typical month -- so a single month is largely a timing question:
-- did that one large shipment land in March or April? Over a quarter or a year
-- those timing errors cancel, and the total can be far more accurate than any
-- of its parts.
--
-- Errors are taken on the TOTAL, not averaged across months: a three-month
-- forecast is right if the three months SUM correctly, even when each
-- individual month is off. That is why the backtest view emits origin-level
-- rows rather than a scorecard.
--
-- mae_pct_of_actual is the comparable figure -- absolute error as a share of
-- what actually arrived, so a 12-month span can be read against a 1-month one.
-- (Per-month MAPE is avoided throughout this project: it explodes on small
-- months and would flatter long spans for the wrong reason.)
--
-- EDIT `window_months = 12` BELOW to whatever C17 chose, then re-run.
--
-- HOW TO READ IT:
--
--   mae_pct_of_actual FALLS as span grows
--       -> totals are more reliable than months. The fiscal-year outlook
--          (April-March) leads the dashboard and the next-month tile is
--          secondary, labelled as the volatile figure it is.
--
--   it is flat or RISES
--       -> errors compound rather than cancel, which means a genuine level
--          error rather than timing noise. Next month leads, and the annual
--          figure ships with a visibly wider band.
-- ############################################################################
with e as (
    select cl_weight_label, origin_month, horizon, predicted, actual
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
      and window_months = 12
),
spans as (
    select unnest(array[1, 3, 6, 12]) as span
),
tot as (
    select e.cl_weight_label,
           e.origin_month,
           s.span,
           sum(e.predicted) as pred_total,
           sum(e.actual)    as act_total
    from e
    cross join spans s
    where e.horizon <= s.span
    group by e.cl_weight_label, e.origin_month, s.span
    having count(*) = s.span
)
select cl_weight_label                                                   as order_book_weight,
       span                                                              as months_in_span,
       count(*)                                                          as origins,
       round(avg(act_total))                                             as avg_actual_total,
       round(avg(abs(pred_total - act_total)))                           as mae_total,
       round(100.0 * avg(abs(pred_total - act_total))
             / nullif(avg(act_total), 0), 1)                             as mae_pct_of_actual,
       round(100.0 * sum(pred_total - act_total)
             / nullif(sum(act_total), 0), 1)                             as bias_pct
from tot
group by cl_weight_label, span
order by cl_weight_label, span;


-- ############################################################################
-- C20 -- ★ DOES THE SMOOTH WEIGHT RULE COST ANYTHING? ★
--
-- C17 found the best order-book weight at 0.2 (h=1), 0.4 (h=3) and 0.8 (h=6).
-- Reading those as three independent answers would mean fitting a separate
-- parameter at every horizon from 12-22 origins each -- which is how a model
-- ends up memorising its own backtest instead of learning from it.
--
-- They are three points on a rising line, so the view now also carries:
--
--     w(h) = least(0.8, 0.2 + 0.12 * (h - 1))
--
-- Two parameters, reproducing the measured optima almost exactly (0.20, 0.44,
-- 0.80), held flat past h=6 because nothing beyond that has been scored.
--
-- HOW TO READ IT:
--
--   smooth w(h) is within ~2% of the best grid point at every horizon
--       -> take it. The gap IS the overfitting, and two parameters that
--          generalise beat twelve that were fitted.
--
--   smooth w(h) is far worse at some horizon
--       -> the relationship is not linear there. Look at which horizon before
--          reaching for a curve -- it is more likely to be a thin sample than a
--          real kink.
--
--   coverage(h) is still competitive at h=3
--       -> it was (rank 3, 2.7% off). Say so in 11g rather than overstating the
--          case against Bornhuetter-Ferguson: BF is wrong at h=1 and h=6 and
--          roughly right in the middle, which is itself informative.
-- ############################################################################
with s as (
    select window_months,
           cl_weight_label,
           horizon,
           count(*)                                  as origins,
           avg(abs(error))                           as mae,
           sum(error) / nullif(sum(actual), 0) * 100 as bias_pct
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
    group by window_months, cl_weight_label, horizon
),
best_grid as (
    select horizon, window_months, min(mae) as best_mae
    from s
    where cl_weight_label not in ('smooth w(h)', 'coverage(h)')
    group by horizon, window_months
),
best_member as (
    select horizon, window_months, min(mae) as best_member_mae
    from (
        select window_months, horizon, estimator, avg(abs(error)) as mae
        from public.v_sales_projection_ensemble_backtest
        where estimator <> 'ensemble'
        group by window_months, horizon, estimator
    ) m
    group by horizon, window_months
)
select s.horizon,
       s.window_months                                                  as cal_window,
       s.cl_weight_label                                                as order_book_weight,
       s.origins,
       round(s.mae)                                                     as mae,
       round(s.bias_pct::numeric, 1)                                    as bias_pct,
       round(g.best_mae)                                                as best_fixed_weight_mae,
       round(100.0 * (s.mae - g.best_mae)
             / nullif(g.best_mae, 0), 1)                                as pct_worse_than_best_weight,
       round(100.0 * (s.mae - bm.best_member_mae)
             / nullif(bm.best_member_mae, 0), 1)                        as pct_vs_best_member
from s
join best_grid   g  on g.horizon  = s.horizon and g.window_months  = s.window_months
join best_member bm on bm.horizon = s.horizon and bm.window_months = s.window_months
where s.cl_weight_label in ('smooth w(h)', 'coverage(h)')
order by s.horizon, s.cl_weight_label, s.mae;


-- ############################################################################
-- C21 -- WHY IS h=12 STILL UNSCOREABLE?
--
-- Even with the scoring view now covering all twelve horizons, C17, C18 and
-- C19 all stop at h=6. The twelve-month number is the one a fiscal-year
-- outlook rests on, so we need to know exactly what is binding before deciding
-- whether to publish it, widen it, or drop it.
--
-- Two conditions have to hold at an origin before it can be scored:
--
--   1. The chain-ladder backtest must reach that far -- target_month has to be
--      a CLOSED month, so a twelve-month horizon burns a year of history.
--   2. Point-in-time calibration needs at least 6 PRIOR scored origins inside
--      the window, before that origin. At h=12 those prior origins are
--      themselves a year old, so the requirement reaches back three years.
--
-- `eligible` then intersects across all four windows, and the 24-month window
-- is the binding one.
--
-- HOW TO READ IT:
--
--   cl_origins is healthy at h=12 but with_6_prior_24m is 0
--       -> the min_origins guard is what is binding, not the data. Scoring
--          h=12 is possible with a shorter window or a lower guard, both of
--          which trade rigour for reach. State the trade rather than taking it
--          silently.
--
--   cl_origins itself collapses at h=12
--       -> there genuinely is not enough closed history to validate a
--          twelve-month forecast. Publish the six-month number as the long
--          horizon, label the twelve-month one as unvalidated, or do not show
--          it at all.
-- ############################################################################
with cl as (
    select horizon, origin_month, target_month
    from public.v_sales_chainladder_backtest
),
counted as (
    select c.horizon,
           c.origin_month,
           n.n_prior
    from cl c
    cross join lateral (
        select count(*) as n_prior
        from cl c2
        where c2.horizon = c.horizon
          and c2.target_month <  c.origin_month
          and c2.target_month >= (c.origin_month - interval '24 months')::date
    ) n
)
select horizon,
       count(*)                                        as cl_origins,
       min(origin_month)                               as earliest_origin,
       max(origin_month)                               as latest_origin,
       count(*) filter (where n_prior >= 6)            as with_6_prior_in_24m,
       max(n_prior)                                    as most_prior_available
from counted
group by horizon
order by horizon;


-- ############################################################################
-- C22 -- ★ ARE THE INTERVALS THE RIGHT WIDTH? ★
--
-- The one thing in this project that has never been scored.
--
-- Every POINT estimate has been backtested to death -- twelve methods, twelve
-- horizons, four calibration windows, seven order-book weights. The INTERVALS
-- around them have only ever been constructed, never checked. An 80% band that
-- actually contains 95% of outcomes is not safely conservative; it is
-- uninformative, and a reader who notices will stop trusting the number inside
-- it too.
--
-- HOW THIS WORKS
--
-- The published band is multiplicative, because it comes from a lognormal:
-- lo_80 / projected and hi_80 / projected are the ratios the model asserts.
-- The backtest gives the ratios history actually produced -- the 10th and 90th
-- percentiles of actual / predicted at each horizon, which by construction is
-- where a correct 80% band should sit.
--
-- Comparing ratios rather than amounts is what makes this valid: the backtest
-- predicted months averaging RM5.0M while the forward view is predicting
-- months around RM4.1M, so absolute widths are not comparable but relative
-- ones are.
--
-- HOW TO READ IT:
--
--   published ratios are WIDER than empirical (lo lower, hi higher)
--       -> the band is too cautious. It will almost never be wrong, and almost
--          never be useful. Scale the variance down to the measured level.
--
--   published ratios are NARROWER than empirical
--       -> the band understates risk, which is the worse failure. Widen it,
--          and say so in 11g.
--
--   they roughly agree
--       -> the variance composition in section 7 is sound. Record that it was
--          checked rather than assumed.
--
-- CAVEAT, and it matters: origins per horizon fall from 22 to 2 (C21), so a
-- 10th percentile at h=10 rests on 4 observations and means very little. Read
-- h=1 to h=6 and treat the rest as indicative. Phase E's frozen snapshots are
-- what will eventually settle this properly, on forecasts that were never
-- refitted.
-- ############################################################################
-- ── SPLIT IN TWO, 2026-10-03 ───────────────────────────────────────────────
-- As a single query this timed out. It joined v_sales_projection_ensemble_
-- backtest -- which rebuilds the blend at ~100 origins across 4 windows and 7
-- weights -- to v_sales_projection_ensemble, which drags in the whole forward
-- chain (chain-ladder, freqsev, SES, baseline, calibration). Either side runs
-- on its own; together they do not.
--
-- Run C22a and C22b separately and keep both outputs. They are keyed on
-- horizon, so they line up directly.
--
-- If C22a still times out, run sql_editor/sales_projection_backtest_cache.sql
-- once and change `v_sales_projection_ensemble_backtest` below to
-- `mv_sales_projection_ensemble_backtest`.


-- ############################################################################
-- C22a -- what history actually produced (backtest side)
--
-- The 10th, 50th and 90th percentiles of actual / predicted at each horizon.
-- By construction that is where a correct 80% band should sit.
--
-- Ratios, not amounts: the backtest predicted months averaging RM5.0M while
-- the forward view is predicting around RM4.1M, so absolute widths are not
-- comparable but relative ones are.
-- ############################################################################
select horizon,
       count(*)                                                        as origins,
       round(percentile_cont(0.10) within group (order by actual / predicted)::numeric, 2)
                                                                       as empirical_lo_ratio,
       round(percentile_cont(0.50) within group (order by actual / predicted)::numeric, 2)
                                                                       as empirical_median_ratio,
       round(percentile_cont(0.90) within group (order by actual / predicted)::numeric, 2)
                                                                       as empirical_hi_ratio
from public.v_sales_projection_ensemble_backtest
where estimator       = 'ensemble'
  and window_months   = 12
  and cl_weight_label = 'smooth w(h)'
  and predicted > 0
group by horizon
order by horizon;


-- ############################################################################
-- C22b -- what the model asserts (forward side)
--
-- The published band as a ratio of the projection, so it can be read directly
-- against C22a.
--
-- A correct 80% interval should have published_lo_ratio near C22a's
-- empirical_lo_ratio and published_hi_ratio near its empirical_hi_ratio.
-- Wider means too cautious -- never wrong, never useful. Narrower understates
-- risk, which is the worse failure.
--
-- ── RUN THE `set` LINE TOGETHER WITH THE QUERY ─────────────────────────────
--
-- This times out at the default limit, and the reason is structural rather
-- than incidental. ONE query to v_sales_projection_ensemble recomputes
-- v_sales_projection_baseline FOUR times -- via v_sales_model_ses, via
-- v_sales_projection_backtest -> v_sales_model_baseline, via
-- v_sales_projection_calibration, and directly -- and recomputes
-- v_sales_chainladder_backtest TWICE, via the calibration view and via
-- v_sales_model_chainladder, which started reading it on 2026-10-03 to take
-- its variance from measured error instead of a Bernoulli formula.
--
-- That is six full backtest rebuilds to produce twelve rows.
--
-- `set` is session-scoped in the Supabase SQL editor, so select both
-- statements and run them together.
--
-- ⚠ THIS IS A PHASE D BLOCKER, not just a diagnostics annoyance. The RPC
-- behind the dashboard will call this view on every page load, and no tile can
-- afford six backtest rebuilds. Materialising v_sales_projection_baseline and
-- v_sales_chainladder_backtest is a prerequisite for Phase D -- both are
-- backtests over CLOSED history and cannot change until a month closes.
-- Recorded in the deployment guide.
-- ############################################################################
set statement_timeout = '300s';

select horizon,
       round(projected)                                   as projected,
       round(sd)                                          as sd,
       round((lo_80 / projected)::numeric, 2)             as published_lo_ratio,
       round((hi_80 / projected)::numeric, 2)             as published_hi_ratio,
       round(lo_80)                                       as published_lo_80,
       round(hi_80)                                       as published_hi_80,
       round(((hi_80 - lo_80) / projected)::numeric, 2)   as published_width_ratio
from public.v_sales_projection_ensemble
order by horizon;


-- ############################################################################
-- C23 -- ★ THE SCALE FACTOR FOR THE INTERVALS ★
--
-- C22 established that the published 80% band is 57-143% wider than history
-- supports. This measures by how much, robustly, so the correction is fitted
-- rather than eyeballed.
--
-- WHY NOT JUST USE C22a's PERCENTILES
--
-- A 10th percentile from 12 observations is the second-smallest value. Extreme
-- quantiles are precisely where small samples mislead, and C22a shows the
-- symptom: the "empirical width" SHRINKS from 0.92 at h=3 to 0.54 at h=6,
-- when a forecast three months further out cannot genuinely be more certain.
-- That is the sample thinning from 18 origins to 12, not the model improving.
--
-- RMSE uses every observation rather than two of them, so it degrades far more
-- gracefully. It is also the quantity the interval is built from: the
-- lognormal in section 7 is parameterised by total_var, and sqrt(total_var) is
-- exactly what RMSE measures.
--
-- WHAT TO DO WITH IT
--
--   scale_factor = measured_rmse / published_sd
--
-- The ensemble's total variance should be multiplied by scale_factor^2. A
-- value near 1.0 would mean the composed variance was right; C22 says to
-- expect something closer to 0.5-0.6.
--
-- WATCH: if scale_factor is roughly CONSTANT across h=1..6, apply one number
-- and say so. If it trends, fit it the way the order-book weight was fitted --
-- a smooth rule in the horizon, not twelve separate values from twelve small
-- samples.
--
-- `measured_sd_of_error` is shown alongside RMSE deliberately. RMSE includes
-- bias; the standard deviation does not. A large gap between them says the
-- band is wide because the forecast is OFF-CENTRE, not because it is noisy --
-- and the cure for that is calibration, not a narrower interval.
-- ############################################################################
select horizon,
       count(*)                                        as origins,
       round(avg(predicted))                           as avg_predicted,
       round(avg(actual))                              as avg_actual,

       round(avg(abs(error)))                          as measured_mae,
       round(sqrt(avg(power(error, 2))))               as measured_rmse,
       round(stddev_samp(error))                       as measured_sd_of_error,

       -- how much of the error is bias rather than noise
       round(sum(error) / nullif(sum(actual), 0) * 100, 1)
                                                       as bias_pct
from public.v_sales_projection_ensemble_backtest
where estimator       = 'ensemble'
  and window_months   = 12
  and cl_weight_label = 'smooth w(h)'
group by horizon
order by horizon;


-- ############################################################################
-- C23b -- the same thing next to the published sd, as a ratio
--
-- Run C23 and C23b separately if this one times out -- it touches both the
-- backtest and the forward chain, which is what killed the original C22.
--
-- scale_factor is the number to apply. Multiply the ensemble's total_var by
-- its SQUARE.
-- ############################################################################
set statement_timeout = '300s';

with meas as (
    select horizon,
           count(*)                          as origins,
           sqrt(avg(power(error, 2)))        as measured_rmse
    from public.v_sales_projection_ensemble_backtest
    where estimator       = 'ensemble'
      and window_months   = 12
      and cl_weight_label = 'smooth w(h)'
    group by horizon
),
pub as (
    select horizon, projected, sd
    from public.v_sales_projection_ensemble
)
select p.horizon,
       m.origins,
       round(p.sd)                                               as published_sd,
       round(m.measured_rmse)                                    as measured_rmse,
       round((m.measured_rmse / nullif(p.sd, 0))::numeric, 3)    as scale_factor,
       round((power(m.measured_rmse / nullif(p.sd, 0), 2))::numeric, 3)
                                                                 as variance_multiplier,
       round((100.0 * (p.sd / nullif(m.measured_rmse, 0) - 1))::numeric, 0)
                                                                 as pct_too_wide
from pub p
join meas m on m.horizon = p.horizon
order by p.horizon;


-- ############################################################################
-- ############################################################################
-- C24 -- ★★ THE HONEST SCORECARD ★★   (stage 1-2, 2026-10-14)
--
-- Everything above this line chose parameters and reported accuracy from the
-- SAME observations. That is the failure the M competitions were created to
-- expose, and it means every accuracy figure published so far is optimistic by
-- an unknown amount.
--
-- C24 splits the two jobs:
--
--     C24a  picks the configuration, using ONLY non-holdout origins
--     C24b  scores that configuration, using ONLY holdout origins
--
-- The holdout is the last 12 origins. Nothing in C24a has seen them.
--
-- RE-RUN ORDER FIRST -- each file on its own:
--
--     1. sql_editor/sales_order_development_pit_view.sql
--     2. sql_editor/sales_projection_materialization.sql   -- SECTION 0 ONLY,
--          plus its one grant and section 5. Sections 1-3 will fail with
--          2BP01, which is the guard working.
--     3. select public.refresh_sales_projection_caches();
--     4. sql_editor/sales_order_development_view.sql        -- now a filter
--     5. sql_editor/sales_chainladder_backtest_view.sql
--     6. sql_editor/sales_projection_ensemble_backtest_view.sql
--     7. select public.refresh_sales_projection_caches();   -- again, for 5-6
--
-- Then C21 (origins should be ~70, not 29), then C24a, then C24b.
-- ############################################################################


-- ############################################################################
-- C24a -- pick the configuration, blind to the holdout
--
-- Same comparison C17 made, with one clause added: `and not is_holdout`.
--
-- WATCH: compare the winning window and weight against what they were on 22
-- observations -- 12 months, and 0.2 rising to 0.8. If they move, the old
-- choice was fitted to a sample too small to decide it, which is exactly what
-- this exercise set out to find.
-- ############################################################################
with ens as (
    select window_months,
           cl_weight_label,
           horizon,
           count(*)                                  as origins,
           avg(abs(error))                           as mae,
           sum(error) / nullif(sum(actual), 0) * 100 as bias_pct
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
      and not is_holdout
    group by window_months, cl_weight_label, horizon
),
ranked as (
    select e.*,
           rank() over (partition by e.horizon order by e.mae) as rank_at_horizon
    from ens e
)
select horizon,
       rank_at_horizon,
       cl_weight_label                                as order_book_weight,
       window_months                                  as cal_window,
       origins,
       round(mae)                                     as mae,
       round(bias_pct::numeric, 1)                    as bias_pct
from ranked
where horizon in (1, 3, 6, 12)
  and (rank_at_horizon <= 3 or cl_weight_label in ('coverage(h)', 'smooth w(h)'))
order by horizon, rank_at_horizon;


-- ############################################################################
-- C24b -- ★ THE NUMBER THAT CAN BE QUOTED ★   (CORRECTED 2026-10-14)
--
-- ⚠ THE FIRST VERSION OF THIS BLOCK WAS WRONG, and wrong in exactly the way it
-- existed to prevent. It picked each estimator's best configuration BY
-- HOLD-OUT MAE -- so every estimator got to choose its settings using the
-- hold-out, which is the whole thing a hold-out is for. Its numbers were
-- optimistic and the ensemble's wins at h=3 and h=6 were partly that artefact.
--
-- This version does it properly:
--
--     `chosen`  picks ONE configuration per horizon from the SELECTION rows
--     `scored`  then scores every estimator on the HOLD-OUT at that fixed
--               configuration, with no further choosing
--
-- Members carry cl_weight_label = 'n/a' and exist once per window, so they are
-- pinned to the chosen WINDOW only; the ensemble is pinned to window and
-- weight both.
--
-- EXPECT THIS TO BE WORSE than the first version. That is the correction
-- working, not the model degrading.
--
-- THE DECISION:
--
--   ensemble 1st, or within a few percent of the best single model
--       -> ship the blend. This MAE is the accuracy figure for the dashboard.
--
--   a single model beats it clearly
--       -> ship that model. Simpler, and the number is honest.
--
--   nothing beats seasonal_naive at a horizon
--       -> publish nothing at that horizon and say why.
--
-- The hold-out is thin -- 11 origins at h=1, 6 at h=6, none at h=12 (C24c).
-- Read h=1 with the most confidence and h=6 with the least.
-- ############################################################################
with chosen as (
    -- One configuration per horizon, decided WITHOUT the hold-out.
    select distinct on (horizon) horizon, window_months, cl_weight_label
    from (
        select horizon, window_months, cl_weight_label,
               avg(abs(error)) as mae
        from public.v_sales_projection_ensemble_backtest
        where estimator = 'ensemble'
          and not is_holdout
        group by horizon, window_months, cl_weight_label
    ) q
    order by horizon, mae
),
scored as (
    select b.horizon,
           b.estimator,
           c.window_months,
           c.cl_weight_label                          as ensemble_weight,
           count(*)                                   as origins,
           avg(abs(b.error))                          as mae,
           avg(b.actual)                              as avg_actual,
           sum(b.error) / nullif(sum(b.actual), 0) * 100 as bias_pct
    from public.v_sales_projection_ensemble_backtest b
    join chosen c
      on c.horizon        = b.horizon
     and b.window_months  = c.window_months
     -- the ensemble is pinned to the chosen weight; members have none
     and (b.estimator <> 'ensemble' or b.cl_weight_label = c.cl_weight_label)
    where b.is_holdout
    group by b.horizon, b.estimator, c.window_months, c.cl_weight_label
)
select horizon,
       rank() over (partition by horizon order by mae)   as rnk,
       estimator,
       window_months                                     as cal_window,
       ensemble_weight,
       origins,
       round(mae)                                        as mae,
       -- the figure to quote: typical miss as a share of a typical month
       round(100.0 * mae / nullif(avg_actual, 0))        as mae_pct_of_month,
       round(bias_pct::numeric, 1)                       as bias_pct
from scored
where horizon in (1, 3, 6, 12)
order by horizon, mae;


-- ############################################################################
-- C24d -- what the CURRENTLY SHIPPED settings cost
--
-- C24a says the live configuration -- smooth w(h) on a 12-month window -- is
-- 14-23% worse than achievable at the published horizons, and 155% worse at
-- twelve months. That was measured on the selection rows.
--
-- This scores the shipped settings against the chosen ones on the HOLD-OUT, so
-- the cost of leaving the dashboard as it is can be stated in money rather
-- than in percentages of an in-sample figure.
--
-- `pct_worse` is what the current dashboard is giving away.
-- ############################################################################
with chosen as (
    select distinct on (horizon) horizon, window_months, cl_weight_label
    from (
        select horizon, window_months, cl_weight_label, avg(abs(error)) as mae
        from public.v_sales_projection_ensemble_backtest
        where estimator = 'ensemble' and not is_holdout
        group by horizon, window_months, cl_weight_label
    ) q
    order by horizon, mae
),
holdout as (
    select horizon, window_months, cl_weight_label,
           count(*)         as origins,
           avg(abs(error))  as mae,
           avg(actual)      as avg_actual
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
      and is_holdout
    group by horizon, window_months, cl_weight_label
)
select h_new.horizon,
       c.cl_weight_label                                   as chosen_weight,
       c.window_months                                     as chosen_window,
       round(h_new.mae)                                    as chosen_mae,
       round(100.0 * h_new.mae / nullif(h_new.avg_actual, 0))
                                                           as chosen_pct_of_month,
       round(h_old.mae)                                    as shipped_mae,
       round(100.0 * h_old.mae / nullif(h_old.avg_actual, 0))
                                                           as shipped_pct_of_month,
       round(100.0 * (h_old.mae - h_new.mae)
             / nullif(h_new.mae, 0))                       as pct_worse
from chosen c
join holdout h_new
  on h_new.horizon = c.horizon
 and h_new.window_months = c.window_months
 and h_new.cl_weight_label = c.cl_weight_label
join holdout h_old
  on h_old.horizon = c.horizon
 and h_old.window_months = 12
 and h_old.cl_weight_label = 'smooth w(h)'
where c.horizon in (1, 3, 6)
order by c.horizon;


-- ############################################################################
-- C24c -- sanity: is the holdout actually holding anything out?
--
-- Run this before trusting C24b. Both counts must be non-zero, and the holdout
-- side should be close to 12 origins per horizon at the short end.
--
-- A zero in either column means the split is not working and C24b is
-- meaningless.
-- ############################################################################
select horizon,
       count(*) filter (where not is_holdout) as selection_rows,
       count(*) filter (where is_holdout)     as holdout_rows,
       min(origin_month) filter (where not is_holdout) as selection_from,
       max(origin_month) filter (where not is_holdout) as selection_to,
       min(origin_month) filter (where is_holdout)     as holdout_from,
       max(origin_month) filter (where is_holdout)     as holdout_to
from public.v_sales_projection_ensemble_backtest
where estimator = 'ensemble'
  and window_months = 12
  and cl_weight_label = 'smooth w(h)'
group by horizon
order by horizon;


-- ############################################################################
-- C25 -- did the point-in-time fix actually bind?
--
-- The conversion rates must now MOVE between as-of months. If the column below
-- is flat, the dimension is not binding and the backtest is still scoring past
-- months against rates derived from after them.
--
-- Also check `cohorts_used` rises over time -- early as-of months have less
-- history behind them, which is the honest shape.
-- ############################################################################
select as_of_month,
       round(link_rate::numeric, 4) as rate_at_age_0,
       cohorts_used
from private.mv_sales_order_development_pit
where age_months = 0
order by as_of_month;


-- ############################################################################
-- C26 -- ★ DOES THE 80% BAND ACTUALLY CONTAIN 80%? ★
--
-- ⚠ Now filters cl_weight_label = 'coverage(h)', matching the weight the
-- ensemble view reverted to on 2026-10-14. Measuring the band of a
-- configuration the dashboard does not use would answer nothing.   (2026-10-14)
--
-- The band's shape is now taken from measured quantiles rather than a
-- lognormal, after C22 found the upper bound ~20% too generous and every one
-- of the last 24 months sitting inside a band that should miss one in five.
--
-- This block checks it two ways, and the difference between them matters.
--
--   C26a  in-sample  -- quantiles fitted on all origins, scored on all origins
--   C26b  honest     -- quantiles fitted on SELECTION only, scored on HOLD-OUT
--
-- C26a will come out near 80% almost by construction: the same rows set the
-- quantile and are then tested against it. It verifies the ARITHMETIC, not the
-- forecast. Treat a good result there as "the code works", nothing more.
--
-- C26b is the real test. The quantiles have never seen those months.
-- ############################################################################


-- ############################################################################
-- C26a -- in-sample coverage (checks the arithmetic)
--
-- EXPECT ~80%. Materially above means the monotone guard is widening the band
-- (which it legitimately can -- a running min/max only ever loosens it);
-- materially below means something is wrong with the ratio join.
-- ############################################################################
with q as (
    select horizon,
           percentile_cont(0.100) within group (order by actual / predicted) as q10,
           percentile_cont(0.900) within group (order by actual / predicted) as q90
    from private.mv_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
      and window_months = 12
      and cl_weight_label = 'coverage(h)'
      and predicted > 0
    group by horizon
    having count(*) >= 20
),
r as (
    select horizon,
           min(q10) over (order by horizon rows between unbounded preceding and current row) as lo,
           max(q90) over (order by horizon rows between unbounded preceding and current row) as hi
    from q
)
select b.horizon,
       count(*)                                          as origins,
       round(r.lo::numeric, 2)                           as lo_ratio,
       round(r.hi::numeric, 2)                           as hi_ratio,
       round(100.0 * count(*) filter (
           where b.actual between b.predicted * r.lo and b.predicted * r.hi
       ) / count(*))                                     as pct_inside_80
from private.mv_sales_projection_ensemble_backtest b
join r on r.horizon = b.horizon
where b.estimator = 'ensemble'
  and b.window_months = 12
  and b.cl_weight_label = 'coverage(h)'
  and b.predicted > 0
group by b.horizon, r.lo, r.hi
order by b.horizon;


-- ############################################################################
-- C26b -- ★ THE HONEST COVERAGE TEST ★
--
-- ⚠ READS THE VIEW, NOT THE CACHE. `is_holdout` was added to
-- v_sales_projection_ensemble_backtest after the cache was created, and
-- `create materialized view ... as select *` freezes its column list at
-- creation -- a refresh re-runs the query but never widens the cache. So the
-- cache carries current DATA with the old SHAPE, and this block reads the view
-- directly. Slower, correct, and fine for a one-off diagnostic.
--
-- Quantiles fitted on the SELECTION rows. Scored on the HOLD-OUT rows, which
-- they have never seen.
--
-- HOW TO READ IT:
--
--   near 80%
--       -> the band is the right width. Publish it and say so: "four months in
--          five land inside this range."
--
--   well above 80% (say 95-100%)
--       -> still too wide. The band will never embarrass anyone and will never
--          tell them anything. Tighten toward the measured quantiles.
--
--   well below 80%
--       -> too narrow, which is the worse failure. A range that misses more
--          often than it claims invites decisions it cannot support.
--
-- CAVEAT, and it is a big one: 11 hold-out months at h=1, 6 at h=6. At six
-- months a single month moves this figure by 17 points. Read h=1, treat the
-- rest as directional.
--
-- The hold-out is also the surge period -- orders up 43%, invoicing down 35%.
-- If coverage is poor it may be the regime rather than the band, which is the
-- same thing walk-forward exists to handle.
-- ############################################################################
with q as (
    select horizon,
           percentile_cont(0.100) within group (order by actual / predicted) as q10,
           percentile_cont(0.900) within group (order by actual / predicted) as q90
    from public.v_sales_projection_ensemble_backtest
    where estimator = 'ensemble'
      and window_months = 12
      and cl_weight_label = 'coverage(h)'
      and predicted > 0
      and not is_holdout
    group by horizon
    having count(*) >= 20
),
r as (
    select horizon,
           min(q10) over (order by horizon rows between unbounded preceding and current row) as lo,
           max(q90) over (order by horizon rows between unbounded preceding and current row) as hi
    from q
)
select b.horizon,
       count(*)                                          as holdout_origins,
       round(r.lo::numeric, 2)                           as lo_ratio,
       round(r.hi::numeric, 2)                           as hi_ratio,
       count(*) filter (
           where b.actual between b.predicted * r.lo and b.predicted * r.hi
       )                                                 as inside,
       round(100.0 * count(*) filter (
           where b.actual between b.predicted * r.lo and b.predicted * r.hi
       ) / count(*))                                     as pct_inside_80,
       -- which side it escapes on. A band failing in one direction only is a
       -- centring problem, not a width problem, and widening would not fix it.
       count(*) filter (where b.actual < b.predicted * r.lo)  as below,
       count(*) filter (where b.actual > b.predicted * r.hi)  as above
from public.v_sales_projection_ensemble_backtest b
join r on r.horizon = b.horizon
where b.estimator = 'ensemble'
  and b.window_months = 12
  and b.cl_weight_label = 'coverage(h)'
  and b.predicted > 0
  and b.is_holdout
group by b.horizon, r.lo, r.hi
order by b.horizon;


-- ############################################################################
-- ############################################################################
-- C27 -- ★★ THE GATE, RE-RUN AGAINST WHAT IS ACTUALLY LIVE ★★  (2026-10-14)
--
-- Every earlier verdict on "does the blend beat its members" tested a
-- configuration that no longer exists:
--
--     C18   smooth w(h), before the point-in-time fix, 22 observations
--     C24b  the C24a-chosen config, which the dashboard never used
--
-- The live configuration is now coverage(h) on a 12-month calibration window,
-- scored against point-in-time conversion rates over ~70 origins. Nothing has
-- yet been tested at that setting.
--
-- Both halves are shown because they answer different questions:
--
--     C27a  all origins   -- 63 down to 41. Statistical power, but the
--                            settings were chosen partly on these months
--     C27b  hold-out only -- 11 down to 1. Honest, and thin
--
-- Read them TOGETHER. Agreement is a real result; disagreement means the
-- answer depends on regime and no fixed configuration settles it.
-- ############################################################################


-- ############################################################################
-- C27a -- the gate on every origin, at the live configuration
--
-- HOW TO READ IT:
--
--   ensemble 1st, or within a few percent
--       -> the blend earns its place at that horizon. Ship it.
--
--   one model beats it clearly and consistently
--       -> ship that model AT THAT HORIZON. Different horizons choosing
--          different models is a legitimate design, not a failure -- the
--          order book genuinely knows more about month six than month one.
--
--   seasonal_naive beats everything
--       -> publish nothing at that horizon.
--
-- WATCH `bias_pct` next to `mae`. A model can win on error size while running
-- consistently high, which on a dashboard reads as a standing false alarm.
-- ############################################################################
with s as (
    select b.estimator,
           b.horizon,
           count(*)                                       as origins,
           avg(abs(b.error))                              as mae,
           avg(b.actual)                                  as avg_actual,
           sum(b.error) / nullif(sum(b.actual), 0) * 100  as bias_pct
    from public.v_sales_projection_ensemble_backtest b
    where b.window_months = 12
      -- the ensemble only at the weight the dashboard uses; members carry
      -- cl_weight_label = 'n/a' and exist once per window
      and (b.estimator <> 'ensemble' or b.cl_weight_label = 'coverage(h)')
    group by b.estimator, b.horizon
)
select horizon,
       rank() over (partition by horizon order by mae)    as rnk,
       estimator,
       origins,
       round(mae)                                         as mae,
       round(100.0 * mae / nullif(avg_actual, 0))         as mae_pct_of_month,
       round(bias_pct::numeric, 1)                        as bias_pct,
       round(100.0 * (mae - min(mae) over (partition by horizon))
             / nullif(min(mae) over (partition by horizon), 0))
                                                          as pct_worse_than_best
from s
where horizon in (1, 3, 6, 12)
order by horizon, mae;


-- ############################################################################
-- C27b -- the same gate, hold-out only
--
-- The settings have never seen these months. Fewer observations, more honest.
--
-- Thin: 11 origins at h=1, 6 at h=6, none at h=12. One unusual month moves
-- h=6 by 17 points. Treat h=1 as the result and the rest as directional.
-- ############################################################################
with s as (
    select b.estimator,
           b.horizon,
           count(*)                                       as origins,
           avg(abs(b.error))                              as mae,
           avg(b.actual)                                  as avg_actual,
           sum(b.error) / nullif(sum(b.actual), 0) * 100  as bias_pct
    from public.v_sales_projection_ensemble_backtest b
    where b.window_months = 12
      and b.is_holdout
      and (b.estimator <> 'ensemble' or b.cl_weight_label = 'coverage(h)')
    group by b.estimator, b.horizon
)
select horizon,
       rank() over (partition by horizon order by mae)    as rnk,
       estimator,
       origins,
       round(mae)                                         as mae,
       round(100.0 * mae / nullif(avg_actual, 0))         as mae_pct_of_month,
       round(bias_pct::numeric, 1)                        as bias_pct,
       round(100.0 * (mae - min(mae) over (partition by horizon))
             / nullif(min(mae) over (partition by horizon), 0))
                                                          as pct_worse_than_best
from s
where horizon in (1, 3, 6)
order by horizon, mae;
