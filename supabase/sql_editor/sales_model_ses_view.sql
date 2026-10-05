-- ############################################################################
-- v_sales_model_ses -- exponential smoothing, forward, with a self-tuning alpha
--
-- Phase C of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on v_sales_monthly_series and
-- v_sales_projection_baseline.
--
-- WHY THIS MODEL EXISTS
--
-- Every other a-priori model here is a trailing mean, and a trailing mean lags
-- a moving level by roughly half its window. Verification C1 measured the
-- consequence directly: over the last 24 origins, freqsev (a 24-month mean)
-- carries +23.4% bias and ranks 9th of 12, having ranked 3rd across full
-- history. Short-memory methods sit at +5-6%. The lag is the whole story.
--
--     Level_t = alpha * y_t + (1 - alpha) * Level_(t-1)
--
-- THE ALPHA IS CHOSEN BY THE DATA
--
-- This view takes no alpha parameter. It reads the scored ses_* methods from
-- v_sales_projection_baseline over a recent window and keeps whichever had the
-- lowest total error, then emits the level that alpha implies today. The
-- chosen value is published so the dashboard can state it.
--
-- C1 found alpha = 0.3 winning the recent window while alpha = 0.1 wins full
-- history -- smooth when the level is stable, react when it is shifting. That
-- inversion is exactly why alpha must be fitted rather than fixed, and why it
-- is re-fitted on every query: if business recovers, it follows.
--
-- ONE ALPHA ACROSS ALL HORIZONS -- deliberate
--
-- SES produces the same level at every horizon, so only its scored error
-- varies with h. Selecting a different alpha per horizon would fit noise in
-- four small samples; the total-error winner is more robust. Per-horizon
-- VARIANCE is still taken from the nearest scored horizon, so intervals widen
-- correctly even though the point estimate does not move.
--
-- CLOSED FORM, NORMALISED
--
--     Level = SUM (1-alpha)^i * y_(t-i)  /  SUM (1-alpha)^i
--
-- The denominator removes truncation bias at 36 terms. Identical to the
-- expression in sales_projection_baseline_view.sql -- the two must agree, and
-- verification C4 checks that they do.
--
-- ── FIXED 2026-10-02, two bugs found by C4 returning zero rows ─────────────
--
--   1. The method filter read `like 'ses\\_%'` -- a doubled backslash, which
--      in SQL means "ses, then a LITERAL backslash, then any character". It
--      matched nothing, so no alpha was ever scored and the view was empty.
--      A single backslash escapes the underscore, which is what was intended.
--
--   2. Horizons came from `distinct on (horizon)` over the scored set, so the
--      view could only emit h = 1, 3, 6 and 12 -- the four horizons the
--      backtest covers. The ensemble joins on h = 1..12 and would have
--      silently dropped eight of them. Horizons are now generated 1..12 and
--      the variance for each is taken from the nearest scored horizon.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_baseline_view.sql.
-- ############################################################################

-- `create or replace` rather than `drop ... cascade`. Dropping deletes every
-- dependant view, which on 2026-10-03 silently removed six of them and cost a
-- full rebuild. Switch back to `drop view if exists ... cascade` ONLY when the
-- COLUMN LIST changes -- renamed, removed, reordered or retyped. Postgres
-- raises 42P16 when that happens, so it tells you; APPENDING a column at the
-- end needs no drop. Full rule in sales_projection_baseline_view.sql.
-- ── READS THE CACHE, NOT THE VIEW (2026-10-03) ─────────────────────────────
-- Sources below point at private.mv_* rather than public.v_*. A single
-- v_sales_projection_ensemble query was rebuilding the scoring harness four
-- times and the chain-ladder backtest twice -- six backtest rebuilds for
-- twelve rows, which timed out C22b and would have been run on every dashboard
-- page load.
--
-- Both are backtests over CLOSED history and cannot change until a month
-- closes or a model is edited. Run sales_projection_materialization.sql first,
-- and re-run public.refresh_sales_projection_caches() after either event or
-- these views will serve stale history without saying so.
create or replace view public.v_sales_model_ses
with (security_invoker = on) as

with params as (
    select 24 as recent_months,
           36 as max_terms
),

bound as (
    select (date_trunc('month', current_date) - (p.recent_months || ' months')::interval)::date
               as cutoff,
           p.max_terms
    from params p
),

-- Recent error for every alpha, at every scored horizon.
alpha_scores as (
    select b.horizon,
           (replace(b.method, 'ses_', '')::numeric / 100.0) as alpha,
           avg(abs(b.predicted - b.actual))                 as mae,
           count(*)                                         as origins
    from private.mv_sales_projection_baseline b
    cross join bound bd
    where b.measure = 'invoiced'
      and b.method like 'ses\_%'          -- single backslash: escapes the underscore
      and b.actual is not null
      and b.period_month >= bd.cutoff
    group by b.horizon, b.method
),

-- One alpha for the whole model: lowest mean error across the scored
-- horizons, rather than four separately-fitted values from small samples.
chosen as (
    select alpha,
           avg(mae)  as mae_overall,
           sum(origins) as origins_total
    from alpha_scores
    group by alpha
    order by avg(mae)
    limit 1
),

-- ── NEAREST-HORIZON LATERAL REMOVED 2026-10-03 ─────────────────────────────
-- v_sales_projection_baseline scored only h = 1/3/6/12, so the eight horizons
-- it could not see had to borrow the nearest one through a correlated lateral.
-- It now scores all twelve, so that lateral found nothing but exact matches --
-- pure cost over an input three times larger. Removing it is what fixed the
-- statement timeout on C5/C6/C7.

-- The chosen alpha's measured error at each horizon, taken directly.
horizon_var as (
    select a.horizon,
           a.mae
    from alpha_scores a
    join chosen c on c.alpha = a.alpha
),

-- The series newest-first, indexed so the geometric weights line up.
recent_series as (
    select value,
           (row_number() over (order by period_month desc) - 1) as i
    from public.v_sales_monthly_series
    where measure = 'invoiced'
      and is_complete
),

level as (
    select c.alpha,
           c.origins_total,
           sum(power(1 - c.alpha, rs.i) * rs.value)
             / nullif(sum(power(1 - c.alpha, rs.i)), 0) as lvl
    from chosen c
    cross join bound bd
    join recent_series rs on rs.i < bd.max_terms
    group by c.alpha, c.origins_total
)

select (date_trunc('month', current_date) + (hv.horizon || ' months')::interval)::date
                                       as period_month,
       hv.horizon,
       'ses'::text                     as model,
       l.lvl                           as predicted,
       -- MSE rather than variance about the mean: it includes bias, which is
       -- the right quantity for a prediction interval.
       power(hv.mae, 2)                as variance,
       l.alpha                         as alpha,
       l.origins_total                 as alpha_origins
from horizon_var hv
cross join level l
order by hv.horizon;


comment on view public.v_sales_model_ses is
    'FORWARD exponential smoothing, h=1..12. Alpha is not a parameter -- it is '
    'fitted by lowest recent-window error across the scored ses_* methods and '
    'republished. Exists because every other a-priori model is a trailing mean '
    'and lags the current decline (C1: freqsev +23.4% bias recently).';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseC_verification.sql
-- Run them one at a time, after this file has succeeded.
