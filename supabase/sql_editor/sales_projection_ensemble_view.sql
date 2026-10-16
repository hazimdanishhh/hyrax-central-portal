-- ############################################################################
-- v_sales_projection_ensemble -- the blend, with intervals
--
-- Phase C of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md. §6 and §7 of
-- the architecture doc. Read-only view.
--
-- Depends on: v_sales_model_chainladder, v_sales_model_baseline,
-- v_sales_model_freqsev, v_sales_model_ses, v_sales_coverage_by_horizon,
-- v_sales_projection_calibration, v_sales_projection_baseline.
--
-- ── THE BLEND ───────────────────────────────────────────────────────────────
--
--     blend(m,h) = w(h) * order_book_implied(m,h)
--                + (1 - w(h)) * apriori(m,h)
--
--     w(h) = least(0.8, 0.2 + 0.12 * (h - 1))
--
-- Generalised Bornhuetter-Ferguson. Textbook BF sets w(h) = coverage(h), on
-- the principle that the order book is observable near term (63% at one month)
-- and silent far out (3% at twelve). The Phase C gate measured that as
-- BACKWARDS for this business: the chain-ladder ranked LAST of six estimators
-- at h=1 while coverage handed it 63% of the blend, and FIRST at h=6 on 13%.
-- Forecasting August 2026 it was +98.6% wrong from one month out and +4.2%
-- wrong from six months out, for the same target month (C15).
--
-- C11 explains it: orders rose 43% year on year while invoicing fell 35%, so
-- the book is filling with business that is not converting. A model reading
-- TODAY'S book over-predicts; the same model reading the book six months ago
-- does not. The order book is a long-range signal here, not a short-range one.
--
-- w(h) was swept over 0.0-1.0 with coverage(h) left in the grid as a
-- candidate, then smoothed to two parameters (C17/C20). coverage(h) still
-- SCALES the chain-ladder to a full-month figure -- that part was never
-- wrong.
--
-- ── WHY IMPLIED FULL-MONTH ESTIMATES ────────────────────────────────────────
--
-- The chain-ladder predicts only the part of a month that traces to existing
-- orders; the a-priori models predict the whole month. Comparing them directly
-- -- for the disagreement term, or on a dashboard exhibit -- would be
-- meaningless, like comparing a deposit against a purchase price.
--
-- So each model is first expressed as what it IMPLIES for the full month:
--
--     chain-ladder   calibrated / coverage(h)
--     a-priori       its own calibrated prediction
--
-- The blend is then a weighted average of comparable quantities, with the
-- chain-ladder carrying weight coverage(h) and the a-priori models sharing
-- (1 - coverage(h)). That is algebraically identical to the formula above, and
-- it is what the §9 method-selection exhibit renders.
--
-- ── VARIANCE (§7) ───────────────────────────────────────────────────────────
--
--     within  = SUM w_m * var_m           each model's own uncertainty
--     between = SUM w_m * (implied_m - blend)^2    how much they disagree
--     total   = within + between
--
-- The law of total variance for a mixture. Both halves are published: tight
-- agreement is evidence, wide disagreement is a warning, and collapsing them
-- into one number would hide which is which.
--
-- ⚠ THIS NO LONGER SIZES THE INTERVAL. C22 measured the composed figure
-- 46-134% too wide across h=1..6. The band now comes from the ensemble's own
-- measured error -- see the `measured_err` CTE below. within_var and
-- between_var remain published for the section 9 confidence exhibit.
--
-- Scaling a model up to full-month also scales its variance: dividing a
-- prediction by coverage divides its standard deviation by the same factor, so
-- the variance divides by coverage squared.
--
-- ── INTERVALS: LOGNORMAL, NOT NORMAL ────────────────────────────────────────
--
--     sigma_sq = ln(1 + total / blend^2);  mu = ln(blend) - sigma_sq/2
--     q(p)     = exp(mu + sqrt(sigma_sq) * z_p)
--
-- Right-skewed, which matches the measured shape: §11e found nine origins
-- over-predicting by more than 50% and NONE under-predicting by more than 50%.
-- Downside is bounded -- revenue cannot fall far below committed orders --
-- while upside is a fat tail, because one large tender can land. A symmetric
-- band would misstate both ends.
--
-- Lognormal rather than gamma for a plain reason: PostgreSQL has no inverse
-- incomplete gamma function, so gamma quantiles cannot be computed here.
--
-- ── WEIGHTS ─────────────────────────────────────────────────────────────────
--
-- Inverse recent-window MAE, normalised, clamped to [0.05, 0.60], renormalised.
-- The clamp stops one model dominating and stops any model silently vanishing
-- -- a model with zero weight is not an ensemble member, it is a deleted one.
--
-- Scored over the RECENT window deliberately. Full-history MAE elected a
-- 24-month mean that currently reads 64% above the trailing three months; see
-- sales_projection_calibration_view.sql for why the regime matters.
--
-- Idempotent. Hand-paste into the Supabase SQL editor. Run LAST of the Phase C
-- views.
-- ############################################################################

-- `create or replace` rather than `drop ... cascade`. Dropping deletes every
-- dependant view, which on 2026-10-03 silently removed six of them and cost a
-- full rebuild. Switch back to `drop view if exists ... cascade` ONLY when the
-- COLUMN LIST changes -- renamed, removed, reordered or retyped. Postgres
-- raises 42P16 when that happens, so it tells you; APPENDING a column at the
-- end needs no drop. Full rule in sales_projection_baseline_view.sql.
--
-- ⚠ NEW DEPENDANT, 2026-10-15: private.mv_sales_projection_ensemble is built
-- FROM this view. A `drop view ... cascade` here now silently deletes that
-- cache too -- the 2026-10-03 failure, one level up -- and the three RPCs that
-- read it then raise 42P01 on the next page load. A column-list change means:
--
--     drop view ... cascade
--  -> re-run this file
--  -> re-run sales_projection_materialization.sql SECTION 6 (recreates the
--     cache, its unique index and its grant)
--  -> select public.refresh_sales_projection_ensemble_cache();
--
-- The cache also FREEZES this view's column list at creation. Appending a
-- column here is invisible to the cache until section 6 is re-run.
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
create or replace view public.v_sales_projection_ensemble
with (security_invoker = on) as

with params as (
    select 24     as recent_months,
           0.05   as min_weight,
           0.60   as max_weight,
           1.2816 as z80,
           1.9600 as z95
),

bound as (
    select (date_trunc('month', current_date) - (p.recent_months || ' months')::interval)::date as cutoff
    from params p
),

-- ── recent accuracy of each a-priori model, for weighting ──────────────────
-- Forward model names map onto the scoring view's method names:
--   baseline -> ma12,  freqsev -> freqsev,  ses -> the chosen ses_0XX
-- Scored only at h = 1, 3, 6, 12 -- the horizons the backtest covers.
apriori_mae as (
    -- ONE scan of the scoring view for both trailing-mean models. It was two,
    -- which at twelve horizons is a second full evaluation of an expensive
    -- view for no extra information.
    select case b.method when 'ma12' then 'baseline' else 'freqsev' end as model,
           b.horizon,
           avg(abs(b.predicted - b.actual)) as mae
    from private.mv_sales_projection_baseline b
    cross join bound bd
    where b.measure = 'invoiced'
      and b.method in ('ma12', 'freqsev')
      and b.actual is not null and b.period_month >= bd.cutoff
    group by 1, b.horizon

    union all

    -- v_sales_model_ses already carries its chosen alpha's recent MAE as
    -- sqrt(variance), at every horizon, so it needs no re-derivation.
    select 'ses', s.horizon, sqrt(s.variance)
    from public.v_sales_model_ses s
),

-- ── NEAREST-HORIZON LATERAL REMOVED 2026-10-03 ─────────────────────────────
-- v_sales_projection_baseline scored only h = 1/3/6/12, so the eight horizons
-- it could not see had to borrow the nearest one through a correlated lateral.
-- It now scores all twelve, so that lateral found nothing but exact matches --
-- pure cost over an input three times larger. Removing it, together with the
-- duplicate reads below, is what fixed the statement timeout on C5/C6/C7.

raw_weights as (
    select model, horizon, 1.0 / nullif(mae, 0) as inv_mae
    from apriori_mae
    where mae is not null and mae > 0
),

normalised as (
    select model, horizon,
           inv_mae / nullif(sum(inv_mae) over (partition by horizon), 0) as w_raw
    from raw_weights
),

clamped as (
    select n.model, n.horizon,
           least(greatest(n.w_raw, p.min_weight), p.max_weight) as w_clamped
    from normalised n
    cross join params p
),

weights as (
    select model, horizon,
           w_clamped / nullif(sum(w_clamped) over (partition by horizon), 0) as weight
    from clamped
),

-- ── the a-priori models, calibrated and weighted ───────────────────────────
-- Each forward view also declares WHICH scoring method it is calibrated
-- against. The forward views publish `baseline`/`freqsev`/`ses`; the
-- calibration view keys a-priori models by scoring name (`ma12`, `freqsev`,
-- `ses_0XX`). Joining those directly once matched only `freqsev`, leaving the
-- other two uncalibrated -- C5 caught it.
--
-- Carried as a COLUMN rather than resolved by a separate lookup CTE, which
-- read v_sales_model_ses a SECOND time purely to recover its alpha. At twelve
-- horizons that doubled the cost of the most expensive branch in this view.
apriori_models as (
    select model, horizon, period_month, predicted, variance,
           'ma12'::text as cal_model
    from public.v_sales_model_baseline
    union all
    select model, horizon, period_month, predicted, variance,
           'freqsev'
    from public.v_sales_model_freqsev
    union all
    select model, horizon, period_month, predicted, variance,
           'ses_' || lpad((alpha * 100)::int::text, 3, '0')
    from public.v_sales_model_ses
),

apriori_cal as (
    select am.model,
           am.horizon,
           am.period_month,
           am.predicted / coalesce(cal.factor, 1)                   as implied,
           am.variance  / power(coalesce(cal.factor, 1), 2)         as implied_var,
           w.weight
    from apriori_models am
    left join public.v_sales_projection_calibration cal
           on cal.model = am.cal_model and cal.horizon = am.horizon
    join weights w
           on w.model = am.model and w.horizon = am.horizon
),

apriori_blend as (
    select horizon,
           period_month,
           sum(implied * weight)     as apriori_value,
           sum(implied_var * weight) as apriori_within
    from apriori_cal
    group by horizon, period_month
),

-- ── the chain-ladder, calibrated and lifted to a full-month equivalent ─────
cl as (
    select c.horizon,
           c.period_month,
           c.predicted / coalesce(cal.factor, 1)            as cl_calibrated,
           c.variance  / power(coalesce(cal.factor, 1), 2)  as cl_var,
           cov.coverage,
           -- ── THE ORDER-BOOK WEIGHT IS coverage(h). REVERTED 2026-10-14.
           --
           -- coverage(h) is the share of a future month that is already
           -- visible in today's order book: 63% next month, 13% at six, 3% at
           -- twelve. The chain-ladder can only predict THAT share -- it knows
           -- nothing about orders not yet placed -- so its estimate is divided
           -- by coverage to express a whole month. At twelve months that is a
           -- multiplication by 33, and the estimate's error multiplies by 33
           -- with it.
           --
           -- Weighting by coverage is therefore self-limiting: as the order
           -- book stops seeing the month, its say shrinks to nothing. That is
           -- why the textbook uses it, and it is structurally impossible for
           -- the blend to explode.
           --
           -- WHAT WENT WRONG. Phase C replaced this with
           -- least(0.8, 0.2 + 0.12*(h-1)) -- rising with horizon, the exact
           -- inverse -- on the strength of 22 observations scored against
           -- conversion rates that had seen the future. On 52 clean
           -- observations coverage(h) ranks 1st at h=3, 1st at h=6 and 2nd at
           -- h=12 (C24a).
           --
           -- The smooth rule's cost was not subtle. It gave 80% of the vote to
           -- an estimate that is 97% extrapolation, and published RM27.9M for
           -- a single month against a RM4.5M norm (C7).
           cov.coverage                                    as cl_weight
    from public.v_sales_model_chainladder c
    left join public.v_sales_projection_calibration cal
           on cal.model = 'chainladder' and cal.horizon = c.horizon
    join public.v_sales_coverage_by_horizon cov
           on cov.horizon = c.horizon
),

blended as (
    select cl.horizon,
           cl.period_month,
           cl.coverage,
           cl.cl_weight,
           cl.cl_calibrated,
           cl.cl_var,
           -- Implied full-month view of an order-book-only estimate. coverage
           -- still SCALES the chain-ladder to a whole month -- that is a
           -- structural ratio and remains correct. It is only its former job as
           -- the blend WEIGHT that the backtest overturned.
           cl.cl_calibrated / nullif(cl.coverage, 0)                as cl_implied,
           cl.cl_var        / nullif(power(cl.coverage, 2), 0)      as cl_implied_var,
           ab.apriori_value,
           ab.apriori_within,
           -- Generalised Bornhuetter-Ferguson. With cl_weight = coverage this
           -- is algebraically the textbook form; the weight is now measured.
           cl.cl_weight * (cl.cl_calibrated / nullif(cl.coverage, 0))
             + (1 - cl.cl_weight) * ab.apriori_value                as blend
    from cl
    join apriori_blend ab
      on ab.horizon = cl.horizon and ab.period_month = cl.period_month
),

-- Disagreement across comparable, full-month estimates.
between_term as (
    select b.horizon,
           b.cl_weight * power(b.cl_implied - b.blend, 2)
           + sum((1 - b.cl_weight) * ac.weight * power(ac.implied - b.blend, 2)) as between_var
    from blended b
    join apriori_cal ac
      on ac.horizon = b.horizon and ac.period_month = b.period_month
    group by b.horizon, b.cl_weight, b.cl_implied, b.blend
),

-- ── INTERVAL WIDTH: MEASURED, NOT COMPOSED (C22/C23, 2026-10-03) ──────────
--
-- `within + between` is the law of total variance for a mixture, and it is the
-- right way to DECOMPOSE uncertainty. It is not the right way to SIZE a
-- prediction interval, and C22 measured the gap: the published 80% band ran
-- 57-143% wider than the band history actually produced.
--
-- The cause is structural, not a tuning error. `within` sums each member's own
-- variance -- but the point of blending is that the ensemble errs LESS than
-- its members do, so their sum overstates it. On top of that the chain-ladder's
-- variance is divided by coverage(h)^2, which explodes as coverage collapses
-- (0.632 at h=1 to 0.030 at h=12), while measured error does not grow at all.
-- C23 shows the published sd rising to RM6.6M at h=11 against a measured RMSE
-- of RM0.85M.
--
-- So the band is taken from the ensemble's OWN measured error, which is what
-- every other model here already does: SES uses power(mae, 2),
-- v_sales_model_baseline uses rmse^2, v_sales_model_chainladder uses measured
-- MSE since 2026-10-03. The ensemble was the last one still asserting a
-- theoretical figure.
--
-- within_var and between_var are still PUBLISHED -- they drive the section 9
-- confidence exhibit, where model disagreement is the point. They just no
-- longer size the band.
measured_err as (
    select horizon,
           count(*)             as origins,
           avg(power(error, 2)) as mse
    from private.mv_sales_projection_ensemble_backtest
    -- MUST MATCH WHAT THIS VIEW ACTUALLY DOES. The weight reverted to
    -- coverage(h) on 2026-10-14 and this filter was not moved with it, so the
    -- band would have been sized from a configuration the view no longer uses.
    -- Caught before deploy, but it is the same class of silent mismatch as the
    -- calibration join that left two models uncorrected in Phase C.
    where estimator       = 'ensemble'
      and window_months   = 12
      and cl_weight_label = 'coverage(h)'
    group by horizon
    having count(*) >= 6
),

-- MONOTONE, deliberately. Raw measured error FALLS from RM2.30M at h=3 to
-- RM1.37M at h=6 (C23), which would publish a fan that NARROWS with distance.
-- That is indefensible on its face -- a six-month forecast is not more certain
-- than a one-month one -- and it is a small-sample effect: origins thin from 22
-- to 12, and the chain-ladder's h=6 advantage rests on a pre-surge order book
-- (C15) that will not persist.
--
-- A running maximum says only what the evidence supports: uncertainty is at
-- LEAST this wide, and we cannot demonstrate it grows further. Flat beyond h=3
-- rather than falsely narrowing.
interval_var as (
    select horizon,
           origins,
           max(mse) over (order by horizon
                          rows between unbounded preceding and current row) as var_used
    from measured_err
),

-- ── PER-MODEL DETAIL, for the method-selection exhibit (Phase D) ──────────
--
-- §9 chart 2 shows what EACH model says for the month, with the blend marked.
-- An actuary never shows only the answer -- a reserving exhibit shows every
-- method's indication, the selection, and the reasoning between them. That is
-- what makes the number challengeable rather than merely believable.
--
-- Built here rather than in the RPC so v_sales_projection_ensemble stays the
-- ONLY object Phase D reads. The alternative was the RPC opening
-- v_sales_model_baseline, _freqsev, _ses and _chainladder separately, which
-- would re-evaluate work this view has already done.
--
-- Values are already CALIBRATED and expressed as full-month equivalents, so
-- they are directly comparable with each other and with the blend.
model_detail as (
    select ac.horizon,
           ac.period_month,
           jsonb_agg(
               jsonb_build_object(
                   'model',   ac.model,
                   'implied', round(ac.implied),
                   'weight',  round(ac.weight::numeric, 4)
               )
               order by ac.implied desc
           ) as apriori_models
    from apriori_cal ac
    group by ac.horizon, ac.period_month
),

-- ── THE BAND SHAPE IS NOW MEASURED TOO (2026-10-14) ───────────────────────
--
-- C22 fixed the band's WIDTH by taking it from measured error. It left the
-- SHAPE to a lognormal, and the shape is wrong:
--
--     published   0.52x to 1.59x      history   0.52x to 1.33x
--
-- The lower bound was exact. The upper was ~20% too generous, because a
-- lognormal's right tail is heavier than this series actually produces. The
-- visible symptom: all 24 historical months sit inside the 80% band, when an
-- 80% band should miss one month in five. A band that is never wrong carries
-- no information.
--
-- So the quantiles are taken straight from the backtest rather than from any
-- distribution. No assumption about tail shape survives.
--
-- ⚠ FITTED ON ALL ORIGINS, INCLUDING THE HOLD-OUT. A dispersion estimate needs
-- every observation it can get -- a 10th percentile from 40 points is already
-- thin -- but it does mean the band's own accuracy is unverified, unlike the
-- point estimate's. Stated here rather than discovered later.
-- ::numeric on every quantile is load-bearing. percentile_cont accepts only
-- double precision, so it returns double -- and blend * double is double,
-- which changes lo_80's type from numeric and makes `create or replace` fail
-- with 42P16. Same family as the round(double, int) trap in the diagnostics.
measured_quantiles as (
    select horizon,
           count(*)                                                        as q_origins,
           (percentile_cont(0.100) within group (order by actual / predicted))::numeric as q10,
           (percentile_cont(0.900) within group (order by actual / predicted))::numeric as q90,
           (percentile_cont(0.025) within group (order by actual / predicted))::numeric as q025,
           (percentile_cont(0.975) within group (order by actual / predicted))::numeric as q975
    from private.mv_sales_projection_ensemble_backtest
    where estimator       = 'ensemble'
      and window_months   = 12
      and cl_weight_label = 'coverage(h)'   -- matches the weight above
      and predicted > 0
    group by horizon
    having count(*) >= 20
),

-- MONOTONE, for the same reason the variance is: a band may not NARROW as the
-- forecast reaches further out. Extreme quantiles from 40-odd points wobble,
-- and an honest fan says "at least this wide", never "more certain further
-- away". Running min on the floor, running max on the ceiling.
band_ratios as (
    select horizon,
           q_origins,
           min(q10)  over (order by horizon rows between unbounded preceding and current row) as lo80_ratio,
           max(q90)  over (order by horizon rows between unbounded preceding and current row) as hi80_ratio,
           min(q025) over (order by horizon rows between unbounded preceding and current row) as lo95_ratio,
           max(q975) over (order by horizon rows between unbounded preceding and current row) as hi95_ratio
    from measured_quantiles
),

final as (
    select b.horizon,
           b.period_month,
           b.blend,
           b.coverage,
           b.cl_weight,
           b.cl_implied,
           b.apriori_value,
           b.cl_weight * b.cl_implied_var
             + (1 - b.cl_weight) * b.apriori_within                            as within_var,
           bt.between_var,
           -- Falls back to the composed figure at any horizon the backtest
           -- cannot reach, so the view can never emit a null band.
           coalesce(iv.var_used,
                    b.cl_weight * b.cl_implied_var
                      + (1 - b.cl_weight) * b.apriori_within + bt.between_var) as band_var,
           iv.origins                                                          as band_origins,
           md.apriori_models,
           br.lo80_ratio, br.hi80_ratio, br.lo95_ratio, br.hi95_ratio
    from blended b
    join between_term bt on bt.horizon = b.horizon
    left join interval_var iv on iv.horizon = b.horizon
    left join model_detail md
           on md.horizon = b.horizon and md.period_month = b.period_month
    left join band_ratios br on br.horizon = b.horizon
)

select f.period_month,
       f.horizon,
       f.blend                                                   as projected,
       f.coverage,
       f.cl_weight                                               as order_book_weight,
       f.cl_implied                                              as implied_from_order_book,
       f.apriori_value                                           as implied_from_apriori,
       f.within_var,
       f.between_var,
       -- total_var and sd describe the PUBLISHED band, so they report the
       -- measured figure. composed_var at the end carries within + between for
       -- anything that needs the decomposition's own total.
       f.band_var                                                as total_var,
       sqrt(f.band_var)                                          as sd,

       -- measured quantile; the lognormal survives only where the backtest
       -- cannot reach, so the view can never emit a null bound
       coalesce(f.blend * f.lo80_ratio,
                exp(ln(f.blend) - ln(1 + f.band_var / power(f.blend, 2)) / 2
                    - sqrt(ln(1 + f.band_var / power(f.blend, 2))) * p.z80)) as lo_80,
       -- measured quantile; the lognormal survives only where the backtest
       -- cannot reach, so the view can never emit a null bound
       coalesce(f.blend * f.hi80_ratio,
                exp(ln(f.blend) - ln(1 + f.band_var / power(f.blend, 2)) / 2
                    + sqrt(ln(1 + f.band_var / power(f.blend, 2))) * p.z80)) as hi_80,
       -- measured quantile; the lognormal survives only where the backtest
       -- cannot reach, so the view can never emit a null bound
       coalesce(f.blend * f.lo95_ratio,
                exp(ln(f.blend) - ln(1 + f.band_var / power(f.blend, 2)) / 2
                    - sqrt(ln(1 + f.band_var / power(f.blend, 2))) * p.z95)) as lo_95,
       -- measured quantile; the lognormal survives only where the backtest
       -- cannot reach, so the view can never emit a null bound
       coalesce(f.blend * f.hi95_ratio,
                exp(ln(f.blend) - ln(1 + f.band_var / power(f.blend, 2)) / 2
                    + sqrt(ln(1 + f.band_var / power(f.blend, 2))) * p.z95)) as hi_95,

       -- Appended rather than inserted: `create or replace view` can add
       -- columns at the END but cannot reorder them.
       f.within_var + f.between_var                              as composed_var,
       f.band_origins,

       -- The exhibit, in one column. Order-book and a-priori members side by
       -- side with the blend they produce -- all full-month equivalents, all
       -- post-calibration, so the three are directly comparable.
       jsonb_build_object(
           'blend', round(f.blend),
           'orderBook', jsonb_build_object(
               'model',    'chainladder',
               'implied',  round(f.cl_implied),
               'weight',   round(f.cl_weight::numeric, 4),
               'coverage', round(f.coverage::numeric, 4)
           ),
           'apriori', coalesce(f.apriori_models, '[]'::jsonb)
       )                                                         as model_detail

from final f
cross join params p
where f.blend > 0
order by f.horizon;


comment on view public.v_sales_projection_ensemble is
    'Generalised Bornhuetter-Ferguson blend of the order-book and a-priori '
    'models. The order-book weight is w(h) = least(0.8, 0.2 + 0.12*(h-1)), '
    'measured by the Phase C gate rather than taken as coverage(h) -- the '
    'backtest found the chain-ladder WORST at h=1 and BEST at h=6, the inverse '
    'of the actuarial prior. Calibration applied per model and horizon; '
    'lognormal intervals sized from the ensemble''s own measured error, not '
    'from the variance composition. within_var/between_var are still published '
    'and drive the Confidence tile. VALIDATED TO h=6 ONLY -- see C21.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseC_verification.sql
-- Run them one at a time, after this file has succeeded.
