-- ############################################################################
-- v_sales_projection_ensemble_backtest -- ★ THE PHASE C GATE ★
--
-- Phase C of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md. Read-only view.
--
-- Depends on: v_sales_projection_baseline, v_sales_chainladder_backtest,
-- v_sales_coverage_by_horizon.
--
-- ── WHAT THIS DECIDES ───────────────────────────────────────────────────────
--
-- Three questions, and the dashboard cannot be built until all three are
-- answered. None of them is answered by choosing a number that looks sensible.
--
--   1. Does a BLEND beat every individual model? If not, we ship the best
--      single model per horizon and say so. An ensemble that loses to its own
--      members is complexity with no payoff.
--
--   2. How long should the calibration window be? C8 found the chain-ladder's
--      bias flipping sign inside a 24-month window -- under-predicting through
--      the 2025 backlog burn-down, over-predicting through the 2026 slowdown --
--      and reporting a harmless-looking +10.8% that is correct for neither
--      half. Swept over 6, 12, 18 and 24 months.
--
--   3. ★ How much weight should the ORDER BOOK carry at each horizon? ★
--
-- ── WHY QUESTION 3 EXISTS: THE FIRST RUN OVERTURNED THE DESIGN ──────────────
--
-- Bornhuetter-Ferguson hands the chain-ladder a share equal to coverage(h):
-- 63% at one month, 3% at twelve, on the principle that the order book is
-- observable fact near-term and silent long-term.
--
-- The first run of this view measured the opposite. At h=1 the chain-ladder
-- ranked LAST of six estimators (MAE 2.39M) while taking 63% of the blend's
-- weight; at h=6 it ranked FIRST by a factor of two (MAE 0.95M) on 13% of the
-- weight. C15 confirmed it is not an artefact -- forecasting August 2026, the
-- chain-ladder was +98.6% wrong from one month out and +4.2% wrong from six
-- months out, for the same target month.
--
-- C11 explains it: orders surged through 2026 and stopped converting, so a
-- model reading TODAY'S book over-predicts, while the same model reading the
-- book as it stood six months ago does not. The order book is a long-range
-- signal for this business and a poor short-range one -- the inverse of the
-- actuarial prior.
--
-- So the weight is no longer assumed. Note that the BF formula is already a
-- weighted average in disguise:
--
--     cl_cal + (1-coverage) * apriori
--       ==  coverage * (cl_cal / coverage) + (1 - coverage) * apriori
--
-- Sweeping that weight therefore generalises BF rather than replacing it, and
-- coverage(h) stays in the grid as one candidate among several. If the prior is
-- right, it wins on its own merits.
--
-- ── POINT-IN-TIME, OR THE WHOLE EXERCISE IS WORTHLESS ───────────────────────
--
-- At each historical origin the blend is rebuilt using ONLY what was knowable
-- then. Both the calibration factors and the ensemble weights are recomputed
-- from scored months whose TARGET fell strictly before the origin:
--
--     target_month <  origin_month
--     target_month >= origin_month - window
--
-- Using calibration fitted over all history -- including the months being
-- predicted -- would let the model correct itself with the answer. That is
-- lookahead bias, and it is the same defect that retired
-- sales_projection_decomposition_view.sql in Phase 0.
--
-- The swept parameters (window, order-book weight) are NOT point-in-time: they
-- are chosen once, over the whole backtest. That is ordinary hyper-parameter
-- selection and it does mean the reported error is mildly optimistic. Phase E's
-- snapshot accuracy, measured against frozen forecasts, is the honest number
-- and will run a little worse. Recorded in §11g rather than left implicit.
--
-- ── FAIR COMPARISON ACROSS WINDOWS ──────────────────────────────────────────
--
-- A 24-month window needs two years of prior data before it can produce a
-- factor, so it loses early origins that a 6-month window keeps. Scoring them
-- on different samples would make the short window look better purely by
-- forecasting an easier stretch of history. Only origins where EVERY window
-- produced a complete blend are scored -- `eligible` below enforces it.
--
-- ── KNOWN SIMPLIFICATIONS, stated rather than hidden ────────────────────────
--
--   * SES is held at alpha = 0.20, the value v_sales_model_ses currently fits.
--     Re-fitting alpha at every origin inside the sweep multiplies the work
--     several-fold, and C3 shows the ses_0XX factors in a tight band
--     (1.055-1.175 at h=1), so the choice moves the blend little.
--
--   * coverage(h) is taken as it stands today rather than reconstructed per
--     origin. It is a structural ratio, not a fitted parameter, and
--     reconstructing it would mean re-deriving the order book at every origin
--     -- which v_sales_chainladder_backtest already does for the prediction.
--     It now only scales the chain-ladder to a full-month figure; it is no
--     longer the blend weight, so an error in it no longer steers the blend.
--
-- Both are recorded in §11g. Neither can flatter the ensemble relative to its
-- members, because every estimator below is scored under the same assumptions.
--
-- Idempotent. Hand-paste into the Supabase SQL editor. Run AFTER
-- sales_projection_baseline_view.sql (which must already be scoring all twelve
-- horizons) and sales_chainladder_backtest_view.sql.
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
create or replace view public.v_sales_projection_ensemble_backtest
with (security_invoker = on) as

with params as (
    select 6     as min_origins,   -- below this, no factor can be trusted
           0.05  as min_weight,
           0.60  as max_weight
),

-- 6 months dropped 2026-10-14. C12 and C20 both measured it WORST at nearly
-- every horizon -- noise costs more than staleness here. Carrying a candidate
-- already known to lose is pure cost, and the sweep needs the headroom now
-- that origins have gone from 29 to roughly 70.
windows as (
    select unnest(array[12, 18, 24]) as window_months
),

-- The order-book weight grid. NULL means "use coverage(h)" -- the
-- Bornhuetter-Ferguson default, kept in the sweep as a candidate so the
-- original design competes on measured accuracy rather than being assumed or
-- discarded.
cl_weights as (
    select unnest(array[0.0, 0.2, 0.4, 0.6, 0.8, 1.0]::numeric[]) as cl_weight_fixed,
           false                                                  as is_smooth
    union all
    select null::numeric, false        -- coverage(h), the BF default
    union all
    select null::numeric, true         -- the smooth rule, below
),

-- AS MATERIALIZED is load-bearing on all three. v_sales_projection_baseline
-- rebuilds a full feature set per origin and v_sales_chainladder_backtest
-- reconstructs the order book at every origin; inlining either into the
-- correlated laterals below re-evaluates it thousands of times. The chain-ladder
-- view's first draft timed out for exactly this reason -- see the note in
-- sales_model_chainladder_view.sql.
ap as materialized (
    select b.method                                                    as model,
           b.horizon,
           b.period_month                                              as target_month,
           (b.period_month - (b.horizon || ' months')::interval)::date as origin_month,
           b.predicted,
           b.actual
    from private.mv_sales_projection_baseline b
    where b.measure = 'invoiced'
      and b.actual is not null
      and b.method in ('ma12', 'freqsev', 'ses_020')
),

-- target_month is taken from the view rather than recomputed from
-- origin + horizon: the backtest already derives it, and two independent
-- derivations of the same month are two chances to disagree.
-- ── THE HOLD-OUT (2026-10-14) ──────────────────────────────────────────────
--
-- Every parameter in this system was chosen by scoring options against history,
-- and then its accuracy was reported from that same history. The sample used
-- to choose was the sample used to score, which flatters the result by an
-- unknown amount. The M competitions exist partly because of this failure.
--
-- The last 12 origins are now marked. Parameters get chosen on everything
-- else; accuracy gets reported on these alone. That is the one number that can
-- honestly be quoted, and it should come out WORSE than the in-sample figure --
-- if it comes out better, the hold-out is not actually being held out.
holdout_bound as (
    select (date_trunc('month', current_date) - interval '13 months')::date as cutoff
),

cl as materialized (
    select c.horizon,
           c.origin_month,
           c.target_month,
           c.predicted,
           c.target_known_orders,
           c.target_total
    from private.mv_sales_chainladder_backtest c
    where c.target_total > 0
),

-- The naive benchmark: the same month a year earlier, uncalibrated. If nothing
-- here beats this, nothing here has earned a place on a dashboard.
naive as materialized (
    select b.horizon,
           b.period_month                                              as target_month,
           (b.period_month - (b.horizon || ' months')::interval)::date as origin_month,
           b.predicted,
           b.actual
    from private.mv_sales_projection_baseline b
    where b.measure = 'invoiced'
      and b.method = 'seasonal_naive'
      and b.actual is not null
),

-- ── a-priori: bias and error from prior months only ────────────────────────
ap_pit as (
    select w.window_months,
           a.model,
           a.horizon,
           a.origin_month,
           a.target_month,
           a.predicted,
           h.n_prior,
           h.bias_prior,
           h.mae_prior
    from ap a
    cross join windows w
    cross join params p
    cross join lateral (
        select count(*)                                                  as n_prior,
               sum(a2.predicted - a2.actual) / nullif(sum(a2.actual), 0) as bias_prior,
               avg(abs(a2.predicted - a2.actual))                        as mae_prior
        from ap a2
        where a2.model   = a.model
          and a2.horizon = a.horizon
          and a2.target_month <  a.origin_month
          and a2.target_month >= (a.origin_month - (w.window_months || ' months')::interval)::date
    ) h
    where h.n_prior >= p.min_origins
      and h.mae_prior > 0
      and h.bias_prior is not null
),

ap_cal as (
    select ap_pit.*,
           greatest(1 + bias_prior, 0.25) as factor,
           1.0 / mae_prior                as inv_mae
    from ap_pit
),

-- Inverse-error weights across the a-priori models, clamped and renormalised --
-- the same shape as the live ensemble, but built from prior months only. This
-- is the weighting WITHIN the a-priori group; the order book's share of the
-- final blend is the separate swept parameter above.
ap_norm as (
    select c.*,
           c.inv_mae / nullif(sum(c.inv_mae) over (
               partition by c.window_months, c.horizon, c.origin_month), 0) as w_raw
    from ap_cal c
),

ap_clamped as (
    select n.*,
           least(greatest(n.w_raw, p.min_weight), p.max_weight) as w_clamped
    from ap_norm n
    cross join params p
),

ap_weighted as (
    select c.*,
           c.w_clamped / nullif(sum(c.w_clamped) over (
               partition by c.window_months, c.horizon, c.origin_month), 0) as weight
    from ap_clamped c
),

-- Only origins where all three a-priori models survived the min_origins guard.
ap_blend as (
    select window_months,
           horizon,
           origin_month,
           target_month,
           sum(weight * predicted / factor) as apriori_value
    from ap_weighted
    group by window_months, horizon, origin_month, target_month
    having count(*) = 3
),

-- ── chain-ladder: bias from prior months only ──────────────────────────────
cl_pit as (
    select w.window_months,
           c.horizon,
           c.origin_month,
           c.target_month,
           c.predicted,
           c.target_total,
           greatest(1 + h.bias_prior, 0.25) as factor
    from cl c
    cross join windows w
    cross join params p
    cross join lateral (
        select count(*)                                   as n_prior,
               sum(c2.predicted - c2.target_known_orders)
                 / nullif(sum(c2.target_known_orders), 0) as bias_prior
        from cl c2
        where c2.horizon = c.horizon
          and c2.target_month <  c.origin_month
          and c2.target_month >= (c.origin_month - (w.window_months || ' months')::interval)::date
    ) h
    where h.n_prior >= p.min_origins
      and h.bias_prior is not null
),

-- ── one row per origin, BEFORE the order-book weight is applied ────────────
-- Split out from the weighted blend so the individual members are not
-- duplicated once per point on the weight grid: a member's error does not
-- depend on a parameter it never uses.
blend_base as (
    select cp.window_months,
           cp.horizon,
           cp.origin_month,
           cp.target_month,
           cp.target_total                        as actual,
           cov.coverage,
           cp.predicted / cp.factor               as cl_calibrated,
           -- The order book lifted to a full-month equivalent, so it is
           -- comparable with models that predict the whole month.
           (cp.predicted / cp.factor)
             / nullif(cov.coverage, 0)            as cl_implied,
           ab.apriori_value
    from cl_pit cp
    join ap_blend ab
      on ab.window_months = cp.window_months
     and ab.horizon       = cp.horizon
     and ab.origin_month  = cp.origin_month
    join public.v_sales_coverage_by_horizon cov
      on cov.horizon = cp.horizon
),

-- Every window must have produced a blend for an origin before that origin is
-- scored, so the windows are compared over identical history.
eligible as (
    select horizon, origin_month
    from blend_base
    group by horizon, origin_month
    having count(distinct window_months) = (select count(*) from windows)
),

-- ── the blend, at every point on the weight grid ───────────────────────────
-- ── THE SMOOTH RULE ────────────────────────────────────────────────────────
--
-- The first sweep found the optimum order-book weight at 0.2 (h=1), 0.4 (h=3)
-- and 0.8 (h=6) -- three points on what is plainly a rising line. Taking those
-- three numbers literally would mean fitting a separate weight at every horizon
-- from 12-22 origins each, which is how a model ends up memorising its own
-- backtest.
--
--     w(h) = least(0.8, 0.2 + 0.12 * (h - 1))
--
-- Two parameters instead of twelve, and it reproduces the measured optima
-- almost exactly: 0.20 at h=1, 0.44 at h=3, 0.80 at h=6. It is held flat
-- beyond h=6 because nothing past that horizon has been scored -- extrapolating
-- the slope to 1.0 would be asserting something the data has not shown.
--
-- It competes in the grid like everything else. If the per-horizon optima beat
-- it by a wide margin the smoothing is costing real accuracy; if they beat it
-- narrowly, the difference is the overfitting and the smooth rule is the honest
-- choice.
smoothed as (
    select b.*,
           cw.is_smooth,
           case
             when cw.is_smooth
               then least(0.8, 0.2 + 0.12 * (b.horizon - 1))
             else coalesce(cw.cl_weight_fixed, b.coverage)
           end as cl_weight,
           case
             when cw.is_smooth             then 'smooth w(h)'
             when cw.cl_weight_fixed is null then 'coverage(h)'
             else to_char(cw.cl_weight_fixed, 'FM0.0')
           end as cl_weight_label
    from blend_base b
    cross join cl_weights cw
),

blended as (
    select s.*,
           s.cl_weight * s.cl_implied
             + (1 - s.cl_weight) * s.apriori_value as blend
    from smoothed s
),

-- ── every estimator, expressed as a FULL-MONTH figure ──────────────────────
-- The chain-ladder predicts only the order-sourced part of a month, so on its
-- own it is lifted by coverage(h) to be comparable with the rest. Without that
-- it would lose every comparison for a reason unrelated to its accuracy.
--
-- Members carry cl_weight_label = 'n/a': they are emitted ONCE per origin, not
-- once per grid point, because the grid does not touch them.
estimators as (
    select b.window_months, b.cl_weight_label, b.cl_weight,
           b.horizon, b.origin_month, b.target_month, b.actual,
           'ensemble'::text as estimator,
           b.blend          as predicted
    from blended b
    join eligible e on e.horizon = b.horizon and e.origin_month = b.origin_month

    union all

    select b.window_months, 'n/a', null::numeric,
           b.horizon, b.origin_month, b.target_month, b.actual,
           'chainladder',
           b.cl_implied
    from blend_base b
    join eligible e on e.horizon = b.horizon and e.origin_month = b.origin_month

    union all

    select w.window_months, 'n/a', null::numeric,
           w.horizon, w.origin_month, w.target_month, b.actual,
           w.model,
           w.predicted / w.factor
    from ap_weighted w
    join blend_base b
      on b.window_months = w.window_months
     and b.horizon       = w.horizon
     and b.origin_month  = w.origin_month
    join eligible e on e.horizon = w.horizon and e.origin_month = w.origin_month

    union all

    -- Uncalibrated, and repeated across windows so it reads as a flat reference
    -- line rather than appearing to respond to a parameter it does not use.
    select w.window_months, 'n/a', null::numeric,
           n.horizon, n.origin_month, n.target_month, n.actual,
           'seasonal_naive',
           n.predicted
    from naive n
    cross join windows w
    join eligible e on e.horizon = n.horizon and e.origin_month = n.origin_month
)

-- ── EMITTED AT ORIGIN LEVEL, deliberately ──────────────────────────────────
--
-- One row per (window, weight, horizon, origin, estimator) rather than a
-- pre-aggregated scorecard. The gate wants mean error by estimator, but the
-- multi-month test (C14) has to SUM several horizons within an origin before
-- taking any error at all -- a three-month total is not the average of three
-- monthly errors. Aggregating here would force that query to rebuild this
-- entire CTE chain a second time, and the two copies would drift.
select e.window_months,
       e.cl_weight_label,
       e.cl_weight,
       e.horizon,
       e.origin_month,
       e.target_month,
       e.estimator,
       e.predicted,
       e.actual,
       e.predicted - e.actual as error,
       -- Choose parameters where this is FALSE. Report accuracy where it is
       -- TRUE. Mixing the two is what made every figure so far optimistic.
       (e.origin_month > hb.cutoff) as is_holdout
from estimators e
cross join holdout_bound hb
order by e.horizon, e.window_months, e.cl_weight_label, e.estimator, e.origin_month;


comment on view public.v_sales_projection_ensemble_backtest is
    'PHASE C GATE, at origin level. Rebuilds the blend at every historical '
    'origin with point-in-time calibration and weights, sweeping BOTH the '
    'calibration window (6/12/18/24 months) and the order-book weight '
    '(0.0-1.0, plus coverage(h) as the Bornhuetter-Ferguson default), '
    'alongside every individual member and seasonal-naive. The weight is swept '
    'because the first run measured the chain-ladder as the WORST estimator at '
    'h=1 while BF handed it 63% of the blend, and the BEST at h=6 on 13%. '
    'Members carry cl_weight_label = n/a. Aggregate it in '
    'diagnostics/sales_projection_phaseC_verification.sql, blocks C17-C19.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseC_verification.sql
-- Run them one at a time, after this file has succeeded.
