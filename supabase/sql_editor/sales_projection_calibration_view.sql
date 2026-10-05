-- ############################################################################
-- v_sales_projection_calibration -- measured bias per model and horizon
--
-- Phase C of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on v_sales_projection_baseline and
-- v_sales_chainladder_backtest.
--
-- WHY THIS EXISTS
--
-- Every model in the ensemble over-predicts right now, and the backtest
-- averages hide it. Projecting the Phase B models forward gave RM5.69M for
-- November against a trailing three-month actual of RM3.11M -- 83% high --
-- while the same models report only +4% to +8% bias overall.
--
-- The averages are not wrong, they are answering a different question. They
-- cover 106 origins dominated by the 2017-2025 growth era. Revenue has since
-- fallen 36% year on year, and a trailing mean lags a decline by roughly half
-- its window, so a 24-month anchor sits about a year behind. Averaged across
-- both regimes that bias nearly cancels; in the one we are forecasting from,
-- it does not.
--
-- So bias is measured over a RECENT window as well as the full history, and
-- both are published. The ensemble uses the recent figure.
--
-- THIS IS THE ACTUARIAL "INDICATED VERSUS SELECTED" ADJUSTMENT
--
-- A reserving exhibit shows the raw indication, the selected figure, and the
-- reasoning between them. Here the raw model output is the indication, this
-- view is the adjustment, and both are visible on the dashboard's method
-- exhibit rather than one being silently folded into the other.
--
-- Factors are COMPUTED, never hard-coded, so they re-estimate every time the
-- view is queried. If the business recovers, the bias shrinks on its own.
--
-- SMALL-SAMPLE GUARD
--
-- A window with very few scored origins produces a wild factor -- one unusual
-- month can imply a 300% correction. Below MIN_ORIGINS the view falls back to
-- the full-history bias, and `basis` records which was used so the choice is
-- auditable rather than invisible.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_baseline_view.sql and
-- sales_chainladder_backtest_view.sql.
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
create or replace view public.v_sales_projection_calibration
with (security_invoker = on) as

with params as (
    -- 12, not 24. CHOSEN BY MEASUREMENT, not by the regime argument that
    -- opened Phase C.
    --
    -- That argument predicted a SHORT window would win, because revenue fell
    -- 36% year on year and a long window straddles both regimes. The sweep in
    -- v_sales_projection_ensemble_backtest tested 6, 12, 18 and 24 over
    -- identical origins and found the opposite at the short end: 6 months was
    -- the WORST at almost every horizon. Noise costs more than staleness.
    --
    -- 12 months carries the lowest total error across h=1..8 (C20): best or
    -- within ~2% at eight of eleven horizons. It gives up roughly 7% at h=1 and
    -- h=2, where 24 months edges it, and that is accepted rather than fitting a
    -- different window per horizon on 12-22 origins each.
    select 12 as recent_months,   -- the regime window
           6  as min_origins      -- below this, fall back to full history
),

bound as (
    select (date_trunc('month', current_date) - (p.recent_months || ' months')::interval)::date
               as cutoff,
           p.min_origins
    from params p
),

-- ── a-priori models: scored per target month, with actuals attached ────────
apriori as (
    select b.method                                               as model,
           b.horizon,
           count(*)                                               as origins_all,
           sum(b.predicted - b.actual) / nullif(sum(b.actual), 0) as bias_all,
           count(*) filter (where b.period_month >= bd.cutoff)    as origins_recent,
           sum(b.predicted - b.actual) filter (where b.period_month >= bd.cutoff)
             / nullif(sum(b.actual) filter (where b.period_month >= bd.cutoff), 0)
                                                                  as bias_recent
    from private.mv_sales_projection_baseline b
    cross join bound bd
    where b.measure = 'invoiced'
      and b.actual is not null
    group by b.method, b.horizon
),

-- ── chain-ladder: scored per origin, against the orders it could see ───────
chainladder as (
    select 'chainladder'::text                                         as model,
           c.horizon,
           count(*)                                                    as origins_all,
           sum(c.error_vs_known) / nullif(sum(c.target_known_orders), 0)
                                                                       as bias_all,
           count(*) filter (where c.origin_month >= bd.cutoff)         as origins_recent,
           sum(c.error_vs_known) filter (where c.origin_month >= bd.cutoff)
             / nullif(sum(c.target_known_orders) filter (where c.origin_month >= bd.cutoff), 0)
                                                                       as bias_recent
    from private.mv_sales_chainladder_backtest c
    cross join bound bd
    group by c.horizon
),

-- ── NEAREST-HORIZON LATERAL REMOVED 2026-10-03 ─────────────────────────────
-- v_sales_projection_baseline scored only h = 1/3/6/12, so the eight horizons
-- it could not see had to borrow the nearest one through a correlated lateral.
-- It now scores all twelve, so that lateral found nothing but exact matches --
-- pure cost over an input three times larger. Removing it is what fixed the
-- statement timeout on C5/C6/C7.
combined as (
    select model, horizon, origins_all, origins_recent, bias_all, bias_recent
    from apriori
    union all
    select model, horizon, origins_all, origins_recent, bias_all, bias_recent
    from chainladder
)

select c.model,
       c.horizon,
       c.origins_all,
       c.origins_recent,
       c.bias_all,
       c.bias_recent,

       -- Which window the factor is drawn from, and why.
       case when c.origins_recent >= bd.min_origins then 'recent' else 'full history' end
                                                                   as basis,

       -- The bias actually applied.
       case when c.origins_recent >= bd.min_origins
            then c.bias_recent else c.bias_all end                 as bias_used,

       -- Divide a prediction by this to de-bias it. Floored at 0.25 so a
       -- pathological window cannot quadruple a forecast; a factor that low
       -- means the model is broken, not that it needs scaling.
       greatest(
           1 + case when c.origins_recent >= bd.min_origins
                    then c.bias_recent else c.bias_all end,
           0.25
       )                                                            as factor,

       -- How much the two windows disagree. A large value IS the regime
       -- effect, quantified: the model behaves differently now than it did on
       -- average across its whole history.
       case when c.origins_recent >= bd.min_origins
            then c.bias_recent - c.bias_all end                     as regime_gap

from combined c
cross join bound bd
order by c.model, c.horizon;


comment on view public.v_sales_projection_calibration is
    'Measured bias per model and horizon over a recent 24-month window and '
    'over full history. The ensemble divides by `factor`. Recent window is '
    'used where enough origins exist, because trailing means lag the current '
    'decline and the full-history average cancels that out. regime_gap '
    'quantifies the difference.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseC_verification.sql
-- Run them one at a time, after this file has succeeded.
