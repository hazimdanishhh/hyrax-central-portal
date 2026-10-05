-- ############################################################################
-- v_sales_projection_baseline -- every candidate method's BACKWARD prediction
--
-- Phase B of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on v_sales_monthly_series.
--
-- THIS IS THE SCORING VIEW (see architecture doc §0)
--
-- It predicts months that have ALREADY CLOSED and carries an `actual` column,
-- so v_sales_projection_backtest can grade each method. The forward-looking
-- twins that feed the ensemble are separate views
-- (v_sales_model_baseline, v_sales_model_freqsev, v_sales_model_chainladder).
-- Same methods, different shape, different job.
--
-- REWRITTEN 2026-10-02 (Phase B). Two changes:
--
--   1. Horizons extended from {1, 3} to {1, 3, 6, 12}. Nothing had ever been
--      scored past three months, yet the design publishes a twelve-month
--      number -- so every horizon the dashboard shows now has measured
--      accuracy behind it.
--      ^ SUPERSEDED 2026-10-03: now every horizon 1..12. See `horizons` below.
--   2. `freqsev` added as a seventh method (see the note below on why its
--      point estimate is algebraically a 24-month mean).
--
-- RESTRUCTURED: FEATURES ARE COMPUTED ONCE PER ORIGIN, THEN JOINED
--
-- The previous version wrote every window frame out once per horizon -- at two
-- horizons that was tolerable, at four it would have been roughly fifty
-- near-identical window expressions and a guaranteed off-by-one.
--
-- Instead, features are computed ONCE for every month as if that month were
-- the origin (`origin_feat`), using ordinary trailing frames that include the
-- current row. A target month m at horizon h then simply joins to the features
-- of month m-h. Adding a horizon is now one row in `horizons`, not another
-- block of frames.
--
-- This also makes the out-of-sample guarantee easy to see rather than easy to
-- get wrong: everything in `origin_feat` is, by construction, knowable at the
-- origin, and the join is the only thing that decides how far ahead we are
-- predicting.
--
-- WHY IT STILL DOES NOT READ v_sales_monthly_trend
--
-- That view's centred 2x12 moving average uses six months of FUTURE data --
-- correct for describing history, fatal in a backtest. The `decomposition`
-- method here rebuilds its own trailing-only trend and an expanding seasonal
-- index from prior same-calendar-month observations.
--
-- WHY TWO BASELINES
--
-- §11 found invoiced revenue down 36.1% year on year. Plain seasonal-naive
-- repeats last year's month into a market a third smaller, so it is
-- systematically high and trivially beaten -- "passes FVA" means little
-- against it. `seasonal_naive_drift` rescales by the trailing annual trend and
-- is the comparator the gate actually believes.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_series_view.sql.
-- ############################################################################

-- ############################################################################
-- ⚠ THIS VIEW USES `create or replace`. KEEP IT THAT WAY. ⚠
--
-- `create or replace view` leaves every dependant intact. `drop ... cascade`
-- deletes them. On 2026-10-03 a cascade here silently removed SIX views and
-- cost a full rebuild, surfacing only as
-- `42P01: relation "public.v_sales_model_ses" does not exist` two steps later.
-- The horizon set had changed, but the COLUMN LIST had not -- so the drop was
-- never necessary in the first place.
--
-- WHEN A DROP IS GENUINELY REQUIRED
--
-- Only when the column list changes: a column renamed, removed, reordered, or
-- changed type. Postgres refuses those with 42P16 ("cannot change name of view
-- column"), so it tells you rather than leaving you to guess. APPENDING a new
-- column at the END is allowed and needs no drop.
--
-- Changing the rows, the filters, the joins, the horizon set or any
-- calculation needs no drop. Those are the overwhelming majority of edits.
--
-- IF YOU DO HAVE TO DROP -- what goes with it, and in what order
--
--     v_sales_projection_baseline                     (this file)
--       ├─> v_sales_projection_backtest               2. sales_projection_backtest_view.sql
--       │     └─> v_sales_model_baseline              3. sales_model_baseline_view.sql
--       ├─> v_sales_model_ses                         4. sales_model_ses_view.sql
--       ├─> v_sales_projection_calibration            5. sales_projection_calibration_view.sql
--       │     └─> v_sales_projection_ensemble         6. sales_projection_ensemble_view.sql
--       ├─> v_sales_projection_ensemble  (also direct)      ^ needs 3, 4 and 5
--       └─> v_sales_projection_ensemble_backtest      7. sales_projection_ensemble_backtest_view.sql
--
-- NOT affected -- they never read this view:
-- v_sales_monthly_series, v_sales_order_development, v_sales_orderbook_open,
-- v_sales_model_chainladder, v_sales_model_freqsev, v_sales_coverage_by_horizon,
-- v_sales_chainladder_backtest.
--
-- Regenerate that list rather than trusting it:
--     grep -l v_sales_projection_baseline supabase/sql_editor/*.sql
-- ############################################################################

-- `create or replace` rather than `drop ... cascade`. Dropping deletes every
-- dependant view, which on 2026-10-03 silently removed six of them and cost a
-- full rebuild. Switch back to `drop view if exists ... cascade` ONLY when the
-- COLUMN LIST changes -- renamed, removed, reordered or retyped. Postgres
-- raises 42P16 when that happens, so it tells you; APPENDING a column at the
-- end needs no drop. Full rule in sales_projection_baseline_view.sql.
create or replace view public.v_sales_projection_baseline
with (security_invoker = on) as

with base as (
    select measure, period_month, value
    from public.v_sales_monthly_series
    where is_complete
),

-- Seasonal ratio against a TRAILING 12-month mean. Trailing, not centred, so
-- the ratio for any past month was already knowable at that month.
ratios as (
    select measure,
           period_month,
           value,
           extract(month from period_month)::int as cal_month,
           value / nullif(
               avg(value) over (
                   partition by measure order by period_month
                   rows between 12 preceding and 1 preceding
               ), 0
           ) as trail_ratio
    from base
),

-- Everything knowable AT a given month, treating it as the origin. All frames
-- include the current row, because at the end of month o, month o is known.
origin_feat as (
    select measure,
           period_month as origin_month,
           value                                                   as last_value,

           avg(value) over w12                                     as lvl12,
           avg(value) over w24                                     as lvl24,
           avg(value) over w3                                      as ma3,
           sum(value) over w12                                     as sum12,
           sum(value) over (
               partition by measure order by period_month
               rows between 23 preceding and 12 preceding
           )                                                       as sum12_prior,

           -- Average monthly change across the trailing year.
           (value - lag(value, 12) over (
               partition by measure order by period_month
           )) / 12.0                                               as step
    from base
    window
        w3  as (partition by measure order by period_month rows between  2 preceding and current row),
        w12 as (partition by measure order by period_month rows between 11 preceding and current row),
        w24 as (partition by measure order by period_month rows between 23 preceding and current row)
),

-- Expanding seasonal index for the TARGET month: the mean trailing ratio of
-- all PRIOR same-calendar-month observations, normalised by the expanding mean
-- of all ratios so far. Those observations sit at m-12, m-24, ... -- at least
-- twelve months back, so they are available at any origin with h <= 12.
target_idx as (
    select measure,
           period_month,
           value,
           avg(trail_ratio) over (
               partition by measure, cal_month order by period_month
               rows between unbounded preceding and 1 preceding
           ) / nullif(
               avg(trail_ratio) over (
                   partition by measure order by period_month
                   rows between unbounded preceding and 1 preceding
               ), 0
           ) as expanding_index,
           lag(value, 12) over (
               partition by measure order by period_month
           ) as sn
    from ratios
),

-- ── Simple exponential smoothing ────────────────────────────────────────────
--
-- Added in Phase C. The bake-off had no level-tracking method at all, and that
-- omission is what let a 24-month mean win: across 106 origins dominated by a
-- growth era, more smoothing meant less noise and the lag cost little. In the
-- current decline the lag dominates -- the 24-month anchor reads RM5.1M while
-- the last three months averaged RM3.1M.
--
--     Level_t = alpha * y_t + (1 - alpha) * Level_(t-1)
--
-- alpha near 0 behaves like a long mean (stable, laggy); alpha near 1 like
-- last-value (responsive, noisy). ALPHA IS FITTED, NOT CHOSEN: every value on
-- the grid is scored as its own method and the harness picks the winner.
--
-- SES is recursive, which SQL windows cannot express directly, so the
-- equivalent closed form is used:
--
--     Level_t = SUM (1-alpha)^i * y_(t-i)  /  SUM (1-alpha)^i
--
-- The denominator normalises away the truncation at 36 terms -- without it,
-- weights sum to 1-(1-alpha)^37 rather than 1, and small alphas would be
-- biased low. It also handles short early history correctly, averaging over
-- whatever months exist.
--
-- The self-join is on an INTEGER month index rather than a date interval:
-- an equi-join the planner can hash, instead of a computed-date comparison.
base_idx as (
    select measure,
           period_month,
           value,
           (extract(year from period_month) * 12 + extract(month from period_month))::int as midx
    from base
),

alphas as (
    -- 0.1 to 0.5. Above 0.5, SES is within noise of last-value, which `drift`
    -- already shows performs badly here (MASE 1.8 at h=12).
    select unnest(array[0.1, 0.2, 0.3, 0.4, 0.5]::numeric[]) as alpha
),

ses_weights as (
    select a.alpha, i.i, power(1 - a.alpha, i.i) as w
    from alphas a
    cross join generate_series(0, 35) as i(i)
),

ses as (
    select b.measure,
           b.period_month                      as origin_month,
           w.alpha,
           sum(w.w * p.value) / nullif(sum(w.w), 0) as level
    from base_idx b
    cross join ses_weights w
    join base_idx p
      on p.measure = b.measure
     and p.midx    = b.midx - w.i
    group by b.measure, b.period_month, w.alpha
),

-- EVERY horizon from 1 to 12, not a sample of four.
--
-- Scoring only {1, 3, 6, 12} forced three downstream views to approximate --
-- the calibration view, the SES view and the ensemble each had to borrow "the
-- nearest scored horizon" for the eight they could not see, and
-- v_sales_model_baseline fell back to the horizon-1 error. Those were all
-- workarounds for this one line.
--
-- It also made two questions unanswerable. Verification C14 could not build a
-- three-month total because there was no h=2 to add, and C12/C13 could not
-- score h=12 at all. Both are the point of a twelve-month projection.
--
-- The cost is three times the rows, which the per-origin feature structure
-- above absorbs: features are computed once per month regardless, and a
-- horizon is only a different join offset.
horizons as (
    select generate_series(1, 12) as horizon
),

-- Each target month paired with the origin it would have been forecast from.
targets as (
    select t.measure,
           t.period_month                                           as period_month,
           t.value                                                  as actual,
           h.horizon,
           (t.period_month - (h.horizon || ' months')::interval)::date as origin_month,
           t.sn,
           t.expanding_index
    from target_idx t
    cross join horizons h
),

joined as (
    select tg.*,
           of.lvl12,
           of.lvl24,
           of.ma3,
           of.sum12,
           of.sum12_prior,
           of.last_value,
           of.step
    from targets tg
    join origin_feat of
      on of.measure      = tg.measure
     and of.origin_month = tg.origin_month
)

-- The published FVA comparator. Repeats last year's same month.
select measure, period_month, actual, horizon,
       'seasonal_naive'::text as method,
       sn as predicted
from joined
where sn is not null

union all

-- The honest comparator: same seasonal shape, rescaled by the trailing annual
-- trend so it tracks a rising or falling market.
select measure, period_month, actual, horizon,
       'seasonal_naive_drift',
       sn * (sum12 / nullif(sum12_prior, 0))
from joined
where sn is not null
  and sum12_prior is not null
  and sum12_prior <> 0

union all

select measure, period_month, actual, horizon, 'ma3', ma3
from joined
where ma3 is not null

union all

select measure, period_month, actual, horizon, 'ma12', lvl12
from joined
where lvl12 is not null

union all

-- Frequency x Severity, point estimate only.
--
-- NOTE, and it matters: E[N] x E[X] is ALGEBRAICALLY a 24-month mean of
-- monthly revenue. With N the invoice count and X the invoice value over the
-- same window,
--
--     E[N] x E[X] = (sum(n)/24) x (sum(x)/sum(n)) = sum(x)/24
--
-- so the frequency-severity POINT forecast cannot differ from `ma24`. It is
-- scored here under its own name so the scorecard lines up with the forward
-- model, and because ma12-vs-ma24 is itself a useful comparison of window
-- length -- but nobody should expect it to beat a moving average, because it
-- IS one.
--
-- The model's real contribution is Var[Revenue] = E[N]Var[X] + Var[N]E[X]^2,
-- which this scoring view has no use for and v_sales_model_freqsev computes.
select measure, period_month, actual, horizon, 'freqsev', lvl24
from joined
where lvl24 is not null

union all

-- Random walk with drift: last known value plus h months of average change.
select measure, period_month, actual, horizon,
       'drift',
       last_value + horizon * step
from joined
where last_value is not null
  and step is not null

union all

-- Engine A in backward-only form: trailing level x expanding seasonal index.
-- Retained as a comparator although Engine A was dropped (§11b) -- the blend
-- still has to prove it beats it.
select measure, period_month, actual, horizon,
       'decomposition',
       lvl12 * expanding_index
from joined
where lvl12 is not null
  and expanding_index is not null

union all

-- Exponential smoothing, one method per alpha on the grid. Named ses_010 ..
-- ses_050 so the scorecard reads as a sweep and the winning alpha is visible
-- rather than buried in a parameter.
select j.measure, j.period_month, j.actual, j.horizon,
       'ses_' || lpad((s.alpha * 100)::int::text, 3, '0'),
       s.level
from joined j
join ses s
  on s.measure      = j.measure
 and s.origin_month = j.origin_month
where s.level is not null;


comment on view public.v_sales_projection_baseline is
    'SCORING view: seven candidate methods predicting CLOSED months, with '
    'actuals attached, at every horizon 1..12. Features computed once per origin '
    'and joined by target-minus-horizon, so the out-of-sample guarantee is '
    'structural. Forward twins live in the v_sales_model_* views.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseB_verification.sql
-- Run them one at a time, after this file has succeeded.
