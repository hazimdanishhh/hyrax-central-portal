-- ############################################################################
-- SALES PROJECTIONS -- PHASE B VERIFICATION
--
-- Read-only. Run ONE BLOCK AT A TIME and keep each output.
--
-- PREREQUISITE -- run these in THIS ORDER, each on its own.
--
-- The order is not cosmetic. sales_projection_baseline_view.sql opens with
-- `drop view ... cascade`, which also drops v_sales_projection_backtest and,
-- through it, v_sales_model_baseline. Both must be recreated afterwards or
-- step 3 fails with 42P01 "relation does not exist".
--
--     1. sql_editor/sales_projection_baseline_view.sql    (rewritten: h=1,3,6,12 + freqsev)
--          ^ its CASCADE drops 2 and 3 below
--     2. sql_editor/sales_projection_backtest_view.sql    (recreate -- unchanged file)
--     3. sql_editor/sales_model_baseline_view.sql         (new; reads 2)
--     4. sql_editor/sales_model_freqsev_view.sql          (new; independent)
--     5. sql_editor/sales_chainladder_backtest_view.sql   (extended to h=12; independent)
--
-- B1-B3 check the frequency-severity decomposition. B4 checks the forward
-- views against their backward twins. B5 is the Phase B deliverable -- the
-- scorecard. B6 drives the exit gate.
-- ############################################################################


-- ############################################################################
-- B1 -- Frequency and severity moments
--
-- Sanity-check against figures already established in architecture doc §11:
--
--   expected_invoice_count   ~105/month (observed range 82-131)
--   expected_invoice_value   ~RM38k for 2026, ~RM54k for 2025 -- a 24-month
--                            window straddles both, so somewhere between
--   months_observed          24
--
-- WATCH: sd_invoice_value should be LARGE relative to expected_invoice_value
-- -- that is the lumpiness the whole model exists to quantify. If it is small,
-- the severity aggregation is wrong, because §11 measured the top three
-- invoices at 31.2% of a typical month.
-- ############################################################################
select distinct
       months_observed,
       total_invoices,
       round(expected_invoice_count, 1)                           as e_n,
       round(sd_invoice_count, 1)                                 as sd_n,
       round(expected_invoice_value)                              as e_x,
       round(sd_invoice_value)                                    as sd_x,
       round(sd_invoice_value / nullif(expected_invoice_value, 0), 2)
                                                                  as x_coeff_of_variation,
       round(sd_invoice_count / nullif(expected_invoice_count, 0), 2)
                                                                  as n_coeff_of_variation
from public.v_sales_model_freqsev;


-- ############################################################################
-- B2 -- Which source of uncertainty dominates?
--
-- The decomposition that justifies this model existing.
--
-- EXPECT severity to dominate heavily -- invoice VALUES are volatile while
-- the COUNT is stable (82-131 a month over three years). If frequency
-- dominates instead, either the window has caught a period of wild volume
-- swings, or var_n is being computed over too few months.
--
-- sd_total is the one-month standard deviation implied by the model. Compare
-- it against the RM2.5M MAE the ma12 baseline carries (§11b): the same order
-- of magnitude is right. Orders out in either direction means the compound
-- formula is wrong.
-- ############################################################################
select distinct
       round(predicted)                                            as predicted_myr,
       round(sqrt(variance))                                       as sd_total_myr,
       round(sqrt(variance) / nullif(predicted, 0), 2)             as coeff_of_variation,
       round(variance_from_severity)                               as var_from_severity,
       round(variance_from_frequency)                              as var_from_frequency,
       round(100.0 * variance_from_severity / nullif(variance, 0), 1)
                                                                   as pct_from_severity,
       round(100.0 * variance_from_frequency / nullif(variance, 0), 1)
                                                                   as pct_from_frequency
from public.v_sales_model_freqsev;


-- ############################################################################
-- B3 -- The lognormal interval this variance implies
--
-- A preview of what §7 will produce, so the numbers can be sanity-checked
-- before the ensemble depends on them. Method of moments:
--
--     sigma_sq = ln(1 + var/mean^2);  mu = ln(mean) - sigma_sq/2
--     q(p)     = exp(mu + sqrt(sigma_sq) * z_p)
--
-- WATCH: the interval must be ASYMMETRIC -- the distance up to hi_80 larger
-- than the distance down to lo_80. That asymmetry is the point (§11e found
-- nine origins over-predicting by >50% and none under-predicting by >50%).
-- A symmetric result means the lognormal transform is not being applied.
--
-- Also: lo_80 should not be absurdly low. If it is near zero the variance is
-- too large for the mean and the model will produce useless bands.
-- ############################################################################
with m as (
    select distinct predicted, variance from public.v_sales_model_freqsev
),
ln_params as (
    select predicted,
           variance,
           ln(1 + variance / nullif(power(predicted, 2), 0)) as sigma_sq
    from m
)
select round(predicted)                                                   as mean_myr,
       round(exp(ln(predicted) - sigma_sq / 2 - sqrt(sigma_sq) * 1.2816))  as lo_80,
       round(exp(ln(predicted) - sigma_sq / 2 + sqrt(sigma_sq) * 1.2816))  as hi_80,
       round(exp(ln(predicted) - sigma_sq / 2 - sqrt(sigma_sq) * 1.9600))  as lo_95,
       round(exp(ln(predicted) - sigma_sq / 2 + sqrt(sigma_sq) * 1.9600))  as hi_95,
       round(exp(ln(predicted) - sigma_sq / 2 + sqrt(sigma_sq) * 1.2816) - predicted)
                                                                          as upside_80,
       round(predicted - exp(ln(predicted) - sigma_sq / 2 - sqrt(sigma_sq) * 1.2816))
                                                                          as downside_80
from ln_params;


-- ############################################################################
-- B4 -- ★ Do the forward views agree with their backward twins? ★
--
-- The check that catches a window frame off by one.
--
-- The backward view's most recent h=1 prediction was made from the same data
-- the forward view uses now, so `baseline` here must match ma12's latest
-- backward prediction almost exactly, and `freqsev` must match the latest
-- freqsev one. Small differences are possible if the backward view's most
-- recent target is not the immediately-preceding month; large ones are a bug.
--
-- freqsev vs baseline will differ a little by construction -- a 24-month mean
-- against a 12-month mean. In a declining market the 24-month figure should
-- be the HIGHER of the two.
-- ############################################################################
select 'forward'  as direction, model, round(predicted) as predicted
from (
    select model, predicted from public.v_sales_model_baseline where horizon = 1
    union all
    select model, predicted from public.v_sales_model_freqsev  where horizon = 1
) f
union all
select 'backward (latest origin)', method, round(predicted)
from public.v_sales_projection_baseline
where measure = 'invoiced'
  and horizon = 1
  and method in ('ma12', 'freqsev')
  and period_month = (
      select max(period_month) from public.v_sales_projection_baseline
      where measure = 'invoiced' and horizon = 1
  )
order by model, direction;


-- ############################################################################
-- B5 -- ★ THE PHASE B DELIVERABLE: the scorecard at every published horizon ★
--
-- Seven methods x four horizons. This is what Phase C's weights are built from,
-- and the first time anything has been scored past three months.
--
-- Read MASE first (below 1 = better than repeating last year), then bias_pct
-- alongside it -- a method can win on error size while over-predicting most
-- months, which on a dashboard reads as a standing false alarm.
--
-- WATCH: origins should fall as horizon rises (fewer target months have a
-- valid origin twelve months back). A horizon with very few origins is not
-- trustworthy however good it looks.
-- ############################################################################
select horizon,
       method,
       origins,
       round(mae)               as mae_myr,
       round(mase, 3)           as mase,
       round(mean_pct_error, 1) as bias_pct,
       round(pct_over, 0)       as pct_months_over
from public.v_sales_projection_backtest
where measure = 'invoiced'
order by horizon, mase;


-- ############################################################################
-- B6 -- ★ THE EXIT GATE: does anything beat a flat run-rate at h=12? ★
--
-- At twelve months, coverage is 3.0% -- the order book contributes nothing --
-- so the projection is almost entirely the a-priori, which is a flat level
-- model. The honest question is whether any method adds anything at that
-- distance over simply carrying today's run-rate forward.
--
-- `ma12` IS the flat run-rate, so it is the comparator here rather than a
-- candidate. Read the others against it.
--
--   Something clearly beats ma12 at h=12
--       -> the twelve-month number is defensible. Proceed to Phase C.
--
--   Nothing beats it, but MASE < 1
--       -> the flat run-rate IS the model at long horizons. Publish it as
--          exactly that, labelled, with wide bands. Still defensible.
--
--   Nothing beats it and MASE >= 1
--       -> twelve months out, we cannot beat "assume last year repeats".
--          Record it in §11f and cap the published horizon rather than
--          shipping a number with no evidence behind it.
-- ############################################################################
select method,
       origins,
       round(mae)               as mae_myr,
       round(mase, 3)           as mase,
       round(mean_pct_error, 1) as bias_pct,
       case when mase < 1 then 'beats seasonal-naive' else 'no better than naive' end
                                as vs_naive
from public.v_sales_projection_backtest
where measure = 'invoiced'
  and horizon = 12
order by mase;


-- ############################################################################
-- B7 -- Chain-ladder at the longer horizons
--
-- Now that the chain-ladder backtest reaches h=12, check it decays sensibly.
-- coverage(12) is 3.0%, so by then it should be predicting very little and
-- its bias should matter less and less to the blend.
-- ############################################################################
select horizon,
       count(*)                                                  as origins,
       round(avg(predicted))                                     as avg_predicted,
       round(avg(target_known_orders))                           as avg_actual_known,
       round(100.0 * sum(error_vs_known)
             / nullif(sum(target_known_orders), 0), 1)           as bias_pct,
       round(avg(abs(error_vs_known)))                           as mae
from public.v_sales_chainladder_backtest
group by horizon
order by horizon;
