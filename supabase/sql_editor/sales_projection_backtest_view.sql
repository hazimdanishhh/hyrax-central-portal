-- ############################################################################
-- v_sales_projection_backtest -- rolling-origin scoring, the Step 4 gate
--
-- Step 3 of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md; its output is
-- what Step 4 decides on. Read-only. Depends on v_sales_projection_baseline.
--
-- Scores every candidate against the actual it was predicting. Because the
-- baseline view's frames are already offset by horizon, each prediction here
-- is genuinely out-of-sample -- this view adds no further time logic, it only
-- measures error.
--
-- MAE AND MASE, NEVER MAPE
--
-- MAPE divides by the actual, so a single small month dominates the average
-- and the statistic becomes unstable precisely where this series is lumpiest.
-- It would return a reassuring number for a useless model. It is deliberately
-- not computed here, so nobody can quote it.
--
-- MASE scales absolute error by the in-sample mean absolute SEASONAL naive
-- error -- the error you would make by assuming every month equals the same
-- month last year. So:
--
--     MASE < 1   better than repeating last year
--     MASE = 1   no better than repeating last year
--     MASE > 1   worse than doing nothing clever
--
-- It is unit-free, so the three measures are directly comparable.
--
-- BIAS IS TRACKED SEPARATELY, AND HERE IT MATTERS MORE THAN USUAL
--
-- A model 10% wrong in alternating directions and one 10% LOW every single
-- month have identical MAE and completely different business meaning. With
-- invoiced revenue down 36.1% year on year (§11), a method that merely lags
-- the decline will look acceptable on MAE while being persistently high --
-- which on a dashboard reads as "we are about to miss target every month".
-- mean_pct_error is signed for exactly this reason: positive = over-predicting.
--
-- THE GATE IS TWO-SIDED
--
-- The architecture's rule is MASE < 1 AND beating seasonal-naive at horizon 1.
-- Phase 0 weakened the second half: in a steep decline seasonal-naive is a
-- trivially easy target. beats_naive_drift is therefore reported alongside and
-- is the figure to actually believe.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_baseline_view.sql.
-- ############################################################################

create or replace view public.v_sales_projection_backtest
with (security_invoker = on) as

with scored as (
    select measure,
           method,
           horizon,
           period_month,
           actual,
           predicted,
           predicted - actual                       as error,
           abs(predicted - actual)                  as abs_error
    from public.v_sales_projection_baseline
    where actual is not null
),

-- The MASE denominator: mean absolute error of the one-step SEASONAL naive
-- over the same series. Computed once per measure, from the series itself
-- rather than from the scored set, so every method is scaled by the same
-- constant and the comparison between them is fair.
naive_scale as (
    select measure,
           avg(abs(value - prev_year)) as mae_seasonal_naive
    from (
        select measure,
               value,
               lag(value, 12) over (partition by measure order by period_month) as prev_year
        from public.v_sales_monthly_series
        where is_complete
    ) q
    where prev_year is not null
    group by measure
),

agg as (
    select s.measure,
           s.method,
           s.horizon,
           count(*)                                         as origins,
           min(s.period_month)                              as first_origin,
           max(s.period_month)                              as last_origin,
           avg(s.abs_error)                                 as mae,
           avg(s.abs_error) / nullif(n.mae_seasonal_naive, 0) as mase,
           avg(s.error)                                     as mean_error,
           -- Signed percentage error against the mean actual, so it is
           -- comparable across measures. Positive = over-predicting.
           avg(s.error) / nullif(avg(s.actual), 0) * 100    as mean_pct_error,
           -- Share of months predicted too high. 50% is unbiased; a value
           -- near 100% means the method never saw the decline.
           100.0 * count(*) filter (where s.error > 0) / count(*) as pct_over,
           sqrt(avg(s.error * s.error))                     as rmse
    from scored s
    join naive_scale n on n.measure = s.measure
    group by s.measure, s.method, s.horizon, n.mae_seasonal_naive
)

select a.measure,
       a.method,
       a.horizon,
       a.origins,
       a.first_origin,
       a.last_origin,
       a.mae,
       a.mase,
       a.rmse,
       a.mean_error,
       a.mean_pct_error,
       a.pct_over,

       -- Gate component 1: better than doing nothing clever.
       (a.mase < 1)                                        as mase_under_1,

       -- Gate component 2 (published rule): beats plain seasonal-naive.
       (a.mae < sn.mae)                                    as beats_naive,

       -- Gate component 3 (the one to believe): beats the drift-adjusted
       -- comparator, which already tracks the decline.
       (a.mae < snd.mae)                                   as beats_naive_drift,

       -- The headline verdict. Deliberately requires the harder comparator:
       -- a method that only beats plain seasonal-naive in a falling market
       -- has demonstrated nothing.
       (a.mase < 1 and a.mae < snd.mae)                    as is_publishable

from agg a
left join agg sn
       on sn.measure = a.measure and sn.horizon = a.horizon
      and sn.method = 'seasonal_naive'
left join agg snd
       on snd.measure = a.measure and snd.horizon = a.horizon
      and snd.method = 'seasonal_naive_drift';


comment on view public.v_sales_projection_backtest is
    'Rolling-origin accuracy per (measure, method, horizon). MAE/MASE/RMSE '
    'plus signed bias. is_publishable requires MASE < 1 AND beating '
    'seasonal_naive_drift -- the harder comparator, since plain seasonal-naive '
    'is trivially beatable in a declining market (see architecture doc §11).';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_step3_verification.sql
-- Run them one at a time, after this file has succeeded.
