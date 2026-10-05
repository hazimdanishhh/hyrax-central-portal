-- ############################################################################
-- v_sales_model_baseline -- §5.4, the FORWARD trailing-mean model
--
-- Phase B of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on v_sales_monthly_series and
-- v_sales_projection_backtest.
--
-- WHY THIS EXISTS WHEN v_sales_projection_baseline ALREADY HAS ma12
--
-- Because they face opposite directions (architecture doc §0).
-- v_sales_projection_baseline predicts months that have already CLOSED and
-- carries an `actual` column, so the backtest can grade it. The ensemble needs
-- a prediction for November 2026, which nothing in that view provides.
--
-- Same method, same window, different question. This is the forward twin.
--
-- WHY ma12 AND NOT SOMETHING CLEVERER
--
-- It won the Step 4 bake-off outright (§11b): MASE 0.760 at h=1, 0.811 at h=3,
-- best on all three measures, beating seasonal decomposition, drift, a
-- 3-month mean and both seasonal-naive variants. On a series with one
-- reliable seasonal month in twelve and a 36% year-on-year decline, a plain
-- trailing mean was simply hard to beat.
--
-- Its role in the ensemble is to anchor the long horizons, where the order
-- book is empty -- coverage(12) is 3.0% -- and to catch whatever the
-- structural models miss.
--
-- THE PREDICTION IS THE SAME AT EVERY HORIZON. THIS IS DELIBERATE.
--
-- A trailing mean is a LEVEL model: it has no trend or seasonal term, so it
-- says the same thing about next month and about month twelve. The ensemble's
-- behaviour still varies by horizon, because coverage(h) shifts weight between
-- the order book and this -- but the a-priori itself is flat.
--
-- That means the far end of the fan chart is a horizontal line with widening
-- bands. Stated here so it reads as a property of the method rather than a bug
-- somebody later "fixes" by bolting on a trend the backtest never justified.
--
-- WHERE THE VARIANCE COMES FROM
--
-- rmse^2 for ma12 at that horizon, from the scoring harness. RMSE squared is
-- mean squared error, which includes bias as well as scatter -- the right
-- quantity for a prediction interval, where being consistently off by 15%
-- matters exactly as much as being noisy by 15%.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_series_view.sql and
-- sales_projection_backtest_view.sql.
-- ############################################################################

-- `create or replace` rather than `drop ... cascade`. Dropping deletes every
-- dependant view, which on 2026-10-03 silently removed six of them and cost a
-- full rebuild. Switch back to `drop view if exists ... cascade` ONLY when the
-- COLUMN LIST changes -- renamed, removed, reordered or retyped. Postgres
-- raises 42P16 when that happens, so it tells you; APPENDING a column at the
-- end needs no drop. Full rule in sales_projection_baseline_view.sql.
create or replace view public.v_sales_model_baseline
with (security_invoker = on) as

with level as (
    -- Trailing 12-month mean of complete months. One row survives: the most
    -- recent, which is the level we carry forward.
    select avg(value) as lvl12
    from (
        select value
        from public.v_sales_monthly_series
        where measure = 'invoiced'
          and is_complete
        order by period_month desc
        limit 12
    ) q
),

horizons as (
    select generate_series(1, 12) as horizon
),

-- Measured error for ma12 at each horizon. Falls back to the horizon-1 figure
-- if a horizon has not been scored, so the view cannot silently emit a null
-- variance and make the ensemble's interval collapse.
err as (
    select horizon, rmse
    from public.v_sales_projection_backtest
    where measure = 'invoiced'
      and method  = 'ma12'
)

select (date_trunc('month', current_date) + (h.horizon || ' months')::interval)::date
                                                       as period_month,
       h.horizon,
       'baseline'::text                                as model,
       l.lvl12                                         as predicted,
       power(
           coalesce(
               e.rmse,
               (select rmse from err where horizon = 1)
           ), 2
       )                                               as variance
from horizons h
cross join level l
left join err e on e.horizon = h.horizon
order by h.horizon;


comment on view public.v_sales_model_baseline is
    'FORWARD §5.4: trailing 12-month mean, h=1..12. Winner of the Step 4 '
    'bake-off (MASE 0.760). Prediction is identical at every horizon by '
    'construction -- it is a level model with no trend term. Variance is '
    'rmse^2 from the scoring harness, which includes bias.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseB_verification.sql
-- Run them one at a time, after this file has succeeded.
