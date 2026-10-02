-- ############################################################################
-- v_sales_model_freqsev -- §5.2, the collective risk model
--
-- Phase B of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on sap_invoices directly (not on the monthly series
-- -- it needs INDIVIDUAL invoice values, which the series has aggregated away).
--
-- WHAT THIS IS FOR -- READ THIS BEFORE DELETING IT AS REDUNDANT
--
-- Its point estimate is algebraically a 24-month mean of monthly revenue:
--
--     E[N] x E[X] = (sum(n)/24) x (sum(x)/sum(n)) = sum(x)/24
--
-- So `predicted` here CANNOT differ from a 24-month moving average, and it will
-- land close to v_sales_model_baseline's 12-month one. That is not a flaw and
-- not an accident -- it is arithmetic.
--
-- **The point of this model is the VARIANCE.** Nothing else in the ensemble
-- can say why a month is uncertain; this can:
--
--     Var[Revenue] = E[N]·Var[X] + Var[N]·E[X]^2
--                    \_________/   \___________/
--                    how much the   how much the
--                    VALUES vary    COUNT varies
--
-- That decomposition is the whole contribution. Hyrax invoices roughly 105
-- times a month with remarkable stability (82-131 over three years), while
-- invoice VALUES swing enormously -- §11 measured the top three invoices at
-- 31.2% of a typical month and 61% in the worst. Modelling total revenue
-- directly blends a predictable signal with a wild one and loses both. Split
-- them and the uncertainty becomes attributable.
--
-- It also produces an interval that widens for the RIGHT REASON: when a month
-- depends on a few large invoices landing, which is the actual business risk,
-- rather than merely when the recent past was noisy.
--
-- If a future reader finds this view and notices it "just returns a moving
-- average", the answer is: look at the variance column, and at §7.
--
-- WINDOW: TRAILING 24 MONTHS
--
-- Excludes the 2021 outlier year (RM116.9M against RM68-94M neighbours) and
-- most of the pre-2024 regime, when the business ran at 4,009 invoices a year
-- averaging RM22.5k rather than ~1,300 averaging RM54k (§11). Severity
-- statistics from that era describe a different company.
--
-- VARIANCE IS A SINGLE-MONTH FIGURE AT EVERY HORIZON
--
-- Like the baseline, this is a level model -- same prediction and same
-- variance at h=1 and h=12. The ensemble's interval widens with horizon
-- through §7's between-model term and the chain-ladder's withdrawal, not
-- through this.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- ############################################################################

drop view if exists public.v_sales_model_freqsev cascade;

create view public.v_sales_model_freqsev
with (security_invoker = on) as

with bounds as (
    select (date_trunc('month', current_date) - interval '24 months')::date as window_start,
           date_trunc('month', current_date)::date                          as current_month
),

-- Per-month aggregates. Keeping sum(x^2) alongside sum(x) is what makes the
-- severity variance computable without a second pass over individual invoices.
monthly as (
    select date_trunc('month', i.invoice_date::date)::date as period_month,
           count(*)                                        as n,
           sum(i.total_amount_myr)                         as sum_x,
           sum(power(i.total_amount_myr, 2))               as sum_x2
    from public.sap_invoices i
    cross join bounds b
    where i.is_cancelled = 'N'
      and i.invoice_date::date >= b.window_start
      and i.invoice_date::date <  b.current_month      -- complete months only
    group by 1
),

moments as (
    select count(*)                            as months_observed,
           sum(n)                              as total_invoices,

           -- FREQUENCY: how many invoices in a month, and how much that varies.
           avg(n)::numeric                     as e_n,
           coalesce(var_samp(n), 0)::numeric   as var_n,

           -- SEVERITY: pooled across every invoice in the window, not an
           -- average of monthly averages -- a month with 131 invoices should
           -- carry more weight than one with 82.
           sum(sum_x) / nullif(sum(n), 0)      as e_x,
           greatest(
               sum(sum_x2) / nullif(sum(n), 0)
               - power(sum(sum_x) / nullif(sum(n), 0), 2),
               0
           )                                   as var_x
    from monthly
),

horizons as (
    select generate_series(1, 12) as horizon
)

select (date_trunc('month', current_date) + (h.horizon || ' months')::interval)::date
                                                   as period_month,
       h.horizon,
       'freqsev'::text                             as model,

       m.e_n * m.e_x                               as predicted,

       -- Compound-distribution variance. The two terms are reported alongside
       -- so the §9 exhibit can show WHICH source dominates -- for this
       -- business it should be severity by a wide margin.
       (m.e_n * m.var_x) + (m.var_n * power(m.e_x, 2))
                                                   as variance,
       m.e_n * m.var_x                             as variance_from_severity,
       m.var_n * power(m.e_x, 2)                   as variance_from_frequency,

       m.e_n                                       as expected_invoice_count,
       m.e_x                                       as expected_invoice_value,
       sqrt(m.var_n)                               as sd_invoice_count,
       sqrt(m.var_x)                               as sd_invoice_value,
       m.months_observed,
       m.total_invoices
from horizons h
cross join moments m
order by h.horizon;


comment on view public.v_sales_model_freqsev is
    'FORWARD §5.2 collective risk model over a trailing 24 months. The point '
    'estimate is algebraically a 24-month mean and will not differ from one -- '
    'the contribution is Var = E[N]Var[X] + Var[N]E[X]^2, which attributes '
    'uncertainty to volatile invoice VALUES versus variable invoice COUNT and '
    'gives §7 its asymmetric interval.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseB_verification.sql
-- Run them one at a time, after this file has succeeded.
