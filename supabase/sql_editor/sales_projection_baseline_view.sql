-- ############################################################################
-- v_sales_projection_baseline -- every candidate method's prediction
--
-- Step 3 of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on v_sales_monthly_series.
--
-- One row per (measure, target month, horizon, method, prediction). The
-- backtest view scores these against actuals; nothing here looks at errors.
--
-- EVERY PREDICTION IS STRICTLY BACKWARD-LOOKING
--
-- A prediction for month m at horizon h is made at the end of month m-h and
-- may use data through m-h, never later. Each window frame below is offset by
-- h for exactly this reason. This is why the view does NOT read
-- v_sales_monthly_trend: that trend is a CENTRED moving average and uses six
-- months of future data, which is correct for describing history and fatal in
-- a backtest. The decomposition method here recomputes its own trailing-only
-- trend and an expanding seasonal index.
--
-- Get this wrong and the backtest reports a model that cannot exist.
--
-- WHY TWO BASELINES, NOT ONE
--
-- The architecture's FVA gate was written around a single comparator,
-- seasonal-naive. Phase 0 (SALES-PROJECTIONS-ARCHITECTURE.md §11) found
-- invoiced revenue down 36.1% year on year like-for-like. Seasonal-naive
-- repeats last year's month into a market running a third below last year, so
-- it will be systematically high and trivially easy to beat. "Passes FVA" is
-- therefore weak evidence here.
--
-- seasonal_naive_drift is the honest comparator: same seasonal shape, scaled
-- by the trailing-12 vs prior-12 ratio so it tracks the decline. A candidate
-- that cannot beat THAT has not earned a dashboard.
--
-- STYLE NOTE -- deliberately verbose
--
-- Horizons are unpivoted with UNION ALL and methods with UNION ALL, rather
-- than the more compact CROSS JOIN LATERAL (VALUES ...) form, and every window
-- frame is written out in full instead of referencing a named WINDOW clause.
-- That is roughly three times the SQL for identical output. It is worth it:
-- this file is hand-pasted into a SQL editor with no way to unit-test it, and
-- a parse error in a 200-line view is far cheaper to locate when every branch
-- is independently readable and runnable on its own.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_series_view.sql.
-- ############################################################################

drop view if exists public.v_sales_projection_baseline cascade;

create view public.v_sales_projection_baseline
with (security_invoker = on) as

with base as (
    select measure, period_month, value
    from public.v_sales_monthly_series
    where is_complete
),

-- Seasonal ratio against a TRAILING 12-month mean. Trailing, not centred, so
-- the ratio for any past month was already knowable at that month -- and
-- therefore knowable at any later origin.
ratios as (
    select measure,
           period_month,
           value,
           extract(month from period_month)::int as cal_month,
           value / nullif(
               avg(value) over (
                   partition by measure
                   order by period_month
                   rows between 12 preceding and 1 preceding
               ), 0
           ) as trail_ratio
    from base
),

-- Expanding seasonal index: for month m, the mean trail_ratio of all PRIOR
-- same-calendar-month observations. Those sit at m-12, m-24, ... -- all at
-- least 12 months back, so they are available at any origin with h <= 12.
-- Divided by the expanding mean of all ratios so far, so the index is centred
-- on 1.0 using only past information.
idx as (
    select measure,
           period_month,
           value,
           avg(trail_ratio) over (
               partition by measure, cal_month
               order by period_month
               rows between unbounded preceding and 1 preceding
           ) / nullif(
               avg(trail_ratio) over (
                   partition by measure
                   order by period_month
                   rows between unbounded preceding and 1 preceding
               ), 0
           ) as expanding_index
    from ratios
),

feat as (
    select
        measure,
        period_month,
        value as actual,
        expanding_index,
        lag(value, 12) over (partition by measure order by period_month) as sn,

        -- ── horizon 1: everything known through m-1 ──────────────────────
        avg(value) over (partition by measure order by period_month
                         rows between 12 preceding and 1 preceding)  as lvl12_h1,
        avg(value) over (partition by measure order by period_month
                         rows between 3 preceding and 1 preceding)   as ma3_h1,
        sum(value) over (partition by measure order by period_month
                         rows between 12 preceding and 1 preceding)  as sum12_h1,
        sum(value) over (partition by measure order by period_month
                         rows between 24 preceding and 13 preceding) as sum12_prior_h1,
        lag(value, 1) over (partition by measure order by period_month) as last_h1,
        ( lag(value, 1)  over (partition by measure order by period_month)
        - lag(value, 13) over (partition by measure order by period_month)
        ) / 12.0 as step_h1,

        -- ── horizon 3: everything known through m-3 ──────────────────────
        avg(value) over (partition by measure order by period_month
                         rows between 14 preceding and 3 preceding)  as lvl12_h3,
        avg(value) over (partition by measure order by period_month
                         rows between 5 preceding and 3 preceding)   as ma3_h3,
        sum(value) over (partition by measure order by period_month
                         rows between 14 preceding and 3 preceding)  as sum12_h3,
        sum(value) over (partition by measure order by period_month
                         rows between 26 preceding and 15 preceding) as sum12_prior_h3,
        lag(value, 3) over (partition by measure order by period_month) as last_h3,
        ( lag(value, 3)  over (partition by measure order by period_month)
        - lag(value, 15) over (partition by measure order by period_month)
        ) / 12.0 as step_h3
    from idx
),

-- Collapse the two horizons into one shape so the method branches below are
-- written once rather than twice.
byh as (
    select measure, period_month, actual, expanding_index, sn,
           1 as horizon,
           lvl12_h1 as lvl12, ma3_h1 as ma3,
           sum12_h1 as sum12, sum12_prior_h1 as sum12_prior,
           last_h1 as last_value, step_h1 as step
    from feat
    union all
    select measure, period_month, actual, expanding_index, sn,
           3 as horizon,
           lvl12_h3, ma3_h3,
           sum12_h3, sum12_prior_h3,
           last_h3, step_h3
    from feat
)

-- The published FVA comparator. Repeats last year's same month.
select measure, period_month, actual, horizon,
       'seasonal_naive'::text as method,
       sn as predicted
from byh
where sn is not null

union all

-- The honest comparator: same seasonal shape, rescaled by the trailing annual
-- trend so it tracks a rising or falling market.
select measure, period_month, actual, horizon,
       'seasonal_naive_drift',
       sn * (sum12 / nullif(sum12_prior, 0))
from byh
where sn is not null
  and sum12_prior is not null
  and sum12_prior <> 0

union all

-- Level-only, no seasonality. Included because on a series this lumpy they
-- sometimes win, and that would be worth knowing.
select measure, period_month, actual, horizon, 'ma3', ma3
from byh
where ma3 is not null

union all

select measure, period_month, actual, horizon, 'ma12', lvl12
from byh
where lvl12 is not null

union all

-- Random walk with drift: last known value plus h months of average change.
select measure, period_month, actual, horizon,
       'drift',
       last_value + horizon * step
from byh
where last_value is not null
  and step is not null

union all

-- Engine A in backward-only form: trailing level x expanding seasonal index.
select measure, period_month, actual, horizon,
       'decomposition',
       lvl12 * expanding_index
from byh
where lvl12 is not null
  and expanding_index is not null;


comment on view public.v_sales_projection_baseline is
    'Candidate method predictions per (measure, month, horizon). Strictly '
    'backward-looking: all frames offset by horizon, seasonal index expanding. '
    'Does NOT use v_sales_monthly_trend, whose centred MA contains lookahead.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_step3_verification.sql
-- Run them one at a time, after this file has succeeded.
