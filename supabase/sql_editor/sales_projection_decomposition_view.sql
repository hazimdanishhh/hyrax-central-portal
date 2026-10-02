-- ############################################################################
-- v_sales_monthly_trend + v_sales_seasonal_index -- classical decomposition
--
-- Step 3 of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only views. Depends on v_sales_monthly_series.
--
-- Splits each series into trend x seasonality x residual by ratio-to-moving-
-- average. This is a textbook method, not a toy, and on a short series it is
-- frequently competitive with Holt-Winters. Its decisive advantage here is
-- that it is LEGIBLE: when it is wrong you can point at which component
-- failed, which a fitted black box cannot give you.
--
-- WHY A 2x12 MOVING AVERAGE, NOT `6 PRECEDING AND 5 FOLLOWING`
--
-- A centred moving average needs an odd window to sit on a data point. Twelve
-- is even, so a plain 12-month window is off-centre by half a month and drags
-- a half-period of seasonality into the trend. The standard correction is the
-- 2x12 MA: average the two adjacent 12-month windows, which is equivalent to
-- weighting the end months by 1/2. It costs one extra window function.
--
-- THIS VIEW LOOKS FORWARD -- DO NOT USE IT FOR BACKTESTING
--
-- The centred trend uses six months of FUTURE data by construction. That is
-- correct and standard for DESCRIBING a historical series, and it is why these
-- indices are the honest answer to "what does this company's seasonality look
-- like". It is also lookahead bias, so any backtest built on it would flatter
-- itself. sales_projection_backtest_view.sql therefore recomputes its own
-- trailing-only trend and an expanding seasonal index. Keep the two separate.
--
-- NORMALISATION IS NOT OPTIONAL
--
-- The twelve indices are rescaled to average exactly 1.0. Un-normalised
-- indices carry a silent level bias into every projection -- the single
-- easiest way to ship a confidently wrong number from this design.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_series_view.sql.
-- ############################################################################


-- ============================================================================
-- v_sales_monthly_trend -- trend level and seasonal ratio, per month
-- ============================================================================
create or replace view public.v_sales_monthly_trend
with (security_invoker = on) as

with base as (
    select measure, period_month, value
    from public.v_sales_monthly_series
    where is_complete
),

ma as (
    select measure,
           period_month,
           value,
           -- The two adjacent 12-month windows. Each is null until there are
           -- 12 rows available, so the first and last ~6 months of any series
           -- have no trend -- correct, not a defect: a centred average simply
           -- is not defined at the edges. Those rows contribute no seasonal
           -- ratio and are excluded from the index below.
           case when count(*) over (
                    partition by measure order by period_month
                    rows between 6 preceding and 5 following) = 12
                then avg(value) over (
                    partition by measure order by period_month
                    rows between 6 preceding and 5 following)
           end as ma_back,
           case when count(*) over (
                    partition by measure order by period_month
                    rows between 5 preceding and 6 following) = 12
                then avg(value) over (
                    partition by measure order by period_month
                    rows between 5 preceding and 6 following)
           end as ma_fwd
    from base
)

select measure,
       period_month,
       value,
       (ma_back + ma_fwd) / 2.0                                   as trend_value,
       value / nullif((ma_back + ma_fwd) / 2.0, 0)                as seasonal_ratio
from ma;


comment on view public.v_sales_monthly_trend is
    'Centred 2x12 moving-average trend and ratio-to-trend per month. '
    'CONTAINS LOOKAHEAD by construction (uses 6 future months) -- descriptive '
    'only, never for backtesting. Null trend at both series edges is correct.';


-- ============================================================================
-- v_sales_seasonal_index -- one normalised index per calendar month
-- ============================================================================
create or replace view public.v_sales_seasonal_index
with (security_invoker = on) as

with ratios as (
    select measure,
           extract(month from period_month)::int as calendar_month,
           seasonal_ratio
    from public.v_sales_monthly_trend
    where seasonal_ratio is not null
),

raw_index as (
    select measure,
           calendar_month,
           avg(seasonal_ratio)  as raw_index,
           count(*)             as years_observed,
           stddev_samp(seasonal_ratio) as ratio_stddev
    from ratios
    group by measure, calendar_month
)

select measure,
       calendar_month,
       to_char(to_date(calendar_month::text, 'MM'), 'Mon')        as month_name,
       years_observed,
       raw_index,
       -- Rescale so the twelve indices average exactly 1.0.
       raw_index / avg(raw_index) over (partition by measure)     as seasonal_index,
       -- Dispersion of the ratio across years. A high stddev means this
       -- month's "seasonality" is unstable year to year and the index should
       -- not be trusted far -- worth seeing next to the index itself rather
       -- than discovering later through a wide prediction interval.
       ratio_stddev
from raw_index;


comment on view public.v_sales_seasonal_index is
    'Seasonal index per calendar month, normalised to mean 1.0 per measure. '
    'ratio_stddev shows year-to-year stability of each index.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_step3_verification.sql
-- Run them one at a time, after this file has succeeded.
