-- ############################################################################
-- v_sales_projection_accuracy -- what we said, against what happened
--
-- Phase E. Read-only view. Backs the Track Record section of Sales Reports via
-- get_sales_projections().
--
-- Depends on: sales_projection_snapshots, v_sales_monthly_series,
-- private.mv_sales_projection_ensemble_backtest.
--
-- ── TWO SOURCES, NEVER MERGED ───────────────────────────────────────────────
--
--   recorded       from sales_projection_snapshots. What the dashboard
--                  genuinely published, frozen before the outcome was known.
--
--   reconstructed  from the point-in-time backtest, for months that closed
--                  before snapshots existed. Each origin used only data
--                  available to it, so no row was fitted on the month it
--                  predicts -- but the SETTINGS behind it (the 12-month
--                  calibration window, the coverage weighting) were chosen
--                  knowing how all of those months turned out.
--
-- The second is therefore optimistic by an amount nobody can measure. It is
-- included because the alternative is an empty section until well into next
-- year, and a `source` column carries the distinction all the way to the
-- chart, where it is named in the tooltip on every month.
--
-- (It is NOT drawn as a line-style split. That needs a second Recharts series
-- over a sister dataKey, which does not exist in this codebase, and until the
-- first month closes after a snapshot every row here is reconstructed -- so
-- the visual distinction would carry no information at all. Revisit once
-- recorded months exist.)
--
-- It is never collapsed into a single series. The moment these two are
-- averaged together, the honest number is gone.
--
-- ── ONLY CLOSED MONTHS ──────────────────────────────────────────────────────
--
-- The join to v_sales_monthly_series is an INNER join on a complete month, so
-- a forecast with no outcome yet simply does not appear. Today that means the
-- recorded side is empty -- the first snapshot's h=1 target has not closed.
-- That is correct, not a fault.
--
-- This inner join is also the ONLY thing stopping future months reaching the
-- merged fiscal-year chart, and it should stay that way. Loosening it to a
-- left join would admit unscored months and silently change the meaning of
-- every aggregate downstream -- months_scored would start counting months
-- that have no outcome to score. The forward half of that chart is unioned in
-- by get_sales_projections() from v_sales_projection_ensemble, as a
-- separate branch that the aggregates never touch.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run AFTER sales_projection_snapshots_migration.sql.
-- ############################################################################

create or replace view public.v_sales_projection_accuracy
with (security_invoker = on) as

with actuals as (
    select period_month, value as actual
    from public.v_sales_monthly_series
    where measure = 'invoiced'
      and is_complete
),

-- The same measured quantiles the live view uses for its band, so a
-- reconstructed row's interval means the same thing as a recorded one's.
-- Without this the reconstructed side would have no band at all and the
-- coverage figure would silently describe only the recorded months.
-- The ::numeric cast on every percentile is LOAD-BEARING. percentile_cont
-- returns double precision; `predicted * double` is double, which changes this
-- view's output column type and makes `create or replace` fail with 42P16.
-- That has already cost one deploy cycle on the ensemble view -- see its own
-- comment at the measured_quantiles CTE.
band_ratios as (
    select horizon,
           min((percentile_cont(0.100) within group (order by actual / predicted))::numeric)
               over (order by horizon rows between unbounded preceding and current row) as lo80_ratio,
           max((percentile_cont(0.900) within group (order by actual / predicted))::numeric)
               over (order by horizon rows between unbounded preceding and current row) as hi80_ratio,
           min((percentile_cont(0.025) within group (order by actual / predicted))::numeric)
               over (order by horizon rows between unbounded preceding and current row) as lo95_ratio,
           max((percentile_cont(0.975) within group (order by actual / predicted))::numeric)
               over (order by horizon rows between unbounded preceding and current row) as hi95_ratio
    from private.mv_sales_projection_ensemble_backtest
    where estimator       = 'ensemble'
      and window_months   = 12
      and cl_weight_label = 'coverage(h)'
      and predicted > 0
    group by horizon
    having count(*) >= 20
),

recorded as (
    select 'recorded'::text        as source,
           s.snapshot_month,
           s.period_month,
           s.horizon,
           s.projected,
           s.lo_80,
           s.hi_80,
           s.implied_from_order_book,
           s.implied_from_apriori,
           -- Appended 2026-10-14 for the merged fiscal-year chart. The
           -- snapshots table has stored these since Phase E; the view simply
           -- dropped them. Without the 95% band on this side, the chart grows
           -- a faint outer band only to the RIGHT of today, which reads as
           -- "we became more uncertain about the future" when it means "we
           -- only publish a 95% band about the future".
           s.lo_95,
           s.hi_95
    from public.sales_projection_snapshots s
),

reconstructed as (
    select 'reconstructed'::text   as source,
           b.origin_month          as snapshot_month,
           b.target_month          as period_month,
           b.horizon,
           b.predicted             as projected,
           b.predicted * br.lo80_ratio as lo_80,
           b.predicted * br.hi80_ratio as hi_80,
           null::numeric           as implied_from_order_book,
           null::numeric           as implied_from_apriori,
           -- Same position as the recorded branch above. `union all` matches
           -- by POSITION, not by name -- a mismatch here is the bug that once
           -- put an origin COUNT into bias_all and made the chain-ladder
           -- factor read 25.
           b.predicted * br.lo95_ratio as lo_95,
           b.predicted * br.hi95_ratio as hi_95
    from private.mv_sales_projection_ensemble_backtest b
    left join band_ratios br on br.horizon = b.horizon
    where b.estimator       = 'ensemble'
      and b.window_months   = 12
      and b.cl_weight_label = 'coverage(h)'
      and b.predicted > 0
      -- A real snapshot always wins. Reconstruction fills gaps; it never
      -- competes with the record.
      and not exists (
          select 1 from public.sales_projection_snapshots s
          where s.snapshot_month = b.origin_month
            and s.horizon        = b.horizon
      )
),

combined as (
    select * from recorded
    union all
    select * from reconstructed
)

select c.source,
       c.snapshot_month,
       c.period_month,
       c.horizon,
       c.projected,
       c.lo_80,
       c.hi_80,
       c.implied_from_order_book,
       c.implied_from_apriori,
       a.actual,
       c.projected - a.actual                                  as error,
       abs(c.projected - a.actual)                             as abs_error,
       case when a.actual > 0
            then (c.projected - a.actual) / a.actual * 100 end as error_pct,
       -- Null rather than false where no band exists, so a missing interval
       -- cannot be counted as a miss and quietly drag the coverage figure
       -- down.
       case when c.lo_80 is not null and c.hi_80 is not null
            then a.actual between c.lo_80 and c.hi_80 end      as inside_80,
       -- APPENDED at the end of the list, deliberately. Appending needs no
       -- drop; renaming, removing, reordering or retyping does, and reports
       -- itself as 42P16. Nothing else reads this view, so there is no cascade
       -- either way -- but the rule holds regardless.
       --
       -- No inside_95 companion: bandCoverageTarget is 80, and a second
       -- coverage figure in the same tile is exactly the ambiguity this file
       -- spends its length avoiding.
       c.lo_95,
       c.hi_95
from combined c
join actuals a on a.period_month = c.period_month;


comment on view public.v_sales_projection_accuracy is
    'Forecast against outcome, for closed months only. `source` separates '
    'RECORDED rows (frozen snapshots, honest) from RECONSTRUCTED ones (the '
    'point-in-time backtest, filling months that closed before snapshots '
    'existed -- optimistic, because the settings were chosen knowing how those '
    'months turned out). The two are never averaged together. A real snapshot '
    'always displaces a reconstruction for the same origin and horizon.';


-- ── VERIFY ──────────────────────────────────────────────────────────────────
--
--     select source, count(*), min(period_month), max(period_month)
--     from public.v_sales_projection_accuracy
--     group by source;
--
-- Expect `reconstructed` populated and `recorded` EMPTY until a month closes
-- after the first snapshot. Both appearing for the same (snapshot_month,
-- horizon) means the not-exists guard is broken and history is double-counted.
--
--     select horizon, count(*) filter (where inside_80) * 100 / count(*)
--     from public.v_sales_projection_accuracy
--     where inside_80 is not null
--     group by horizon order by horizon;
--
-- Should land near 80% and agree with diagnostic C26a. A material difference
-- means this view and that diagnostic disagree about what "inside the band"
-- means.
--
--     select count(*), count(distinct period_month)
--     from public.v_sales_projection_accuracy
--     where horizon = 1;
--
-- MUST BE EQUAL. get_sales_projections() LEFT JOINs this view onto a
-- 12-month spine; a duplicate (period_month, horizon) would fan that join out
-- and the chart would gain repeated months with no error anywhere.
--
--     select horizon,
--            count(*) filter (where lo_95 is not null) as with_95,
--            count(*)                                  as rows
--     from public.v_sales_projection_accuracy
--     group by horizon order by horizon;
--
-- Added 2026-10-14. with_95 should equal rows at h=1. A zero means
-- band_ratios returned nothing for that horizon -- its `having count(*) >= 20`
-- guard did not clear -- and the chart will draw no outer band on that side of
-- the seam.
-- ############################################################################
