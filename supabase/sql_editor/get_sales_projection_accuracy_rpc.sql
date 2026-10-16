create or replace function get_sales_projection_accuracy(
    p_fiscal_year_start int default null
)
returns json
language plpgsql
-- SECURITY INVOKER (the default, written explicitly). Same posture as
-- get_sales_projections: the guard below is an authorization check, not a
-- privilege escalation, and the caller's own grants are what let
-- sales_projection_snapshots resolve under its RLS policies.
security invoker
as
$$
declare
    result json;
    v_role_name       text;
    v_department_sub  text;
    v_fy_start        int;
begin

-- ############################################################################
-- get_sales_projection_accuracy -- backs the Projections section of Sales
-- Reports (src/pages/user/sales/reports/Reports.jsx).
--
-- Phase E. Companion to get_sales_projections(), deliberately NOT an extension
-- of it: that function takes no arguments, and adding one would need an
-- explicit `drop function` -- `create or replace` cannot alter an argument
-- list, and the orphaned overload left behind breaks PostgREST with PGRST203.
-- A second function leaves a working one alone.
--
-- ── THE NAME UNDER-DESCRIBES IT (2026-10-14) ────────────────────────────────
--
-- It was built to answer "has this forecast been any good?". It now owns the
-- whole fiscal-year timeline -- past AND future -- because the two charts it
-- used to split with get_sales_projections drew the same actual line against
-- the same forecast for every month they shared.
--
-- Kept at this name on purpose. Renaming means drop-and-create, and an
-- orphaned overload is PGRST203. The cost of the stale name is this comment.
--
-- ── WHAT IT ANSWERS ─────────────────────────────────────────────────────────
--
-- For ONE fiscal year: what did we say would happen, what actually happened,
-- and what do we now expect for the months still ahead -- month by month,
-- rather than taken on trust.
--
-- ── TWO DIFFERENT HORIZONS IN ONE SERIES ────────────────────────────────────
--
-- Past months are h=1: what was said one month before. Comparable across a
-- whole year, and the horizon with the most observations behind it.
--
-- Future months are whatever horizon reaches them -- h=1 for next month, h=12
-- for a month a year out. So the forward half of the line is NOT as reliable
-- as the backward half, and the widening band is what says so. The divider at
-- `forecastStartLabel` is where the meaning changes.
--
-- The aggregates in `agg` score the PAST ONLY, at h=1 only. They are not
-- contaminated by the forward branch -- see the banner above that CTE.
--
-- ── RECORDED VERSUS RECONSTRUCTED ───────────────────────────────────────────
--
-- Every row carries `source`. Recorded rows came from a frozen snapshot;
-- reconstructed rows were rebuilt from the point-in-time backtest for months
-- that closed before snapshots existed.
--
-- The counts are published separately in `kpis` so the section can say how
-- much of its own evidence is which. A year that is entirely reconstructed is
-- a weaker claim than one that is entirely recorded, and the dashboard should
-- never present them as the same thing.
-- ############################################################################

-- ─── Access guard ──────────────────────────────────────────────────────────
-- Identical to get_sales_projections(). Mirrors SalesRoutes.jsx's
-- AccessRoute(departments:["SAL","MGM"], roles:["manager"]).
select r.name, d.sub
  into v_role_name, v_department_sub
from profiles p
join roles r on r.id = p.role_id
join departments d on d.id = p.department_id
where p.id = auth.uid();

if v_role_name is distinct from 'superadmin'
   and not (v_role_name = 'manager' and v_department_sub in ('SAL', 'MGM'))
then
    raise exception 'Unauthorized: get_sales_projection_accuracy requires SAL/MGM manager or superadmin'
        using errcode = '42501';
end if;

-- Default to the fiscal year we are in. Same April-March rule as
-- src/functions/fiscalYearPresets.js and get_sales_reports_dashboard's
-- fy_window CTE: on or after April belongs to the FY starting this calendar
-- year, January-March to the one that started last.
v_fy_start := coalesce(
    p_fiscal_year_start,
    (extract(year from current_date)
     - case when extract(month from current_date) >= 4 then 0 else 1 end)::int
);


with bounds as (
    select make_date(v_fy_start, 4, 1)      as fy_start,
           make_date(v_fy_start + 1, 3, 1)  as fy_end_month,
           v_fy_start::text || '-' || (v_fy_start + 1)::text as fy_label
),

-- ############################################################################
-- EVALUATE EACH HEAVY VIEW EXACTLY ONCE. Both `as materialized` markers below
-- are load-bearing, not decoration.
--
-- v_sales_projection_accuracy is not cheap: its `reconstructed` branch scans
-- the whole backtest cache with a correlated `not exists` against snapshots,
-- and its band_ratios runs percentile_cont over the same cache.
--
-- This CTE is read by rows_in_year AND by `years` at the bottom. Postgres
-- materializes a CTE referenced more than once by default (PG12+), but saying
-- so explicitly stops a later edit that drops it to one reference from
-- silently re-planning it as an inlined double scan.
--
-- THE RULE THIS ENCODES: downstream CTEs read acc_h1 and fwd, NEVER the views
-- directly. A reference to the view is a second full evaluation that the
-- planner cannot share with the CTE -- which is exactly what timed this RPC
-- out on first deploy.
-- ############################################################################
acc_h1 as materialized (
    select a.*
    from public.v_sales_projection_accuracy a
    where a.horizon = 1
),

rows_in_year as (
    select a.*
    from acc_h1 a
    cross join bounds b
    where a.period_month >= b.fy_start
      and a.period_month <= b.fy_end_month
),

-- ############################################################################
-- agg READS rows_in_year, AND MUST CONTINUE TO.
--
-- Every figure below counts SCORED months only -- months that closed and had
-- an outcome to compare against. The guarantee comes from inside
-- v_sales_projection_accuracy, which INNER JOINs actuals on `is_complete`, so
-- a month with no outcome produces no row at all.
--
-- Do NOT "simplify" this by re-pointing it at `timeline` below. That CTE is a
-- 12-row spine with one row per fiscal month whether or not anything is known
-- about it, so count(*) would become the constant 12 and monthsScored would
-- silently stop meaning anything.
-- ############################################################################
agg as (
    select count(*)                                              as months_scored,
           count(*) filter (where source = 'recorded')            as recorded_months,
           count(*) filter (where source = 'reconstructed')       as reconstructed_months,
           avg(abs_error)                                         as mae,
           avg(actual)                                            as avg_actual,
           sum(projected)                                         as total_projected,
           sum(actual)                                            as total_actual,
           count(*) filter (where inside_80)                      as inside_count,
           count(*) filter (where inside_80 is not null)          as banded_count
    from rows_in_year
),

-- ############################################################################
-- THE MERGED FISCAL-YEAR TIMELINE (2026-10-14)
--
-- One chart replacing two. Before this, the forward fan (24 rolling months +
-- 6 projected, in get_sales_projections) and the track-record chart (one
-- fiscal year, closed months) drew the SAME actual line against the SAME
-- one-month-ahead forecast for every month they shared.
--
-- This emits one row per month of the selected fiscal year, always twelve:
--
--     past     actual + what was forecast one month ahead + its bands
--     current  forecast and bands only -- NOT month-to-date as an actual
--     future   the projection made today, at whatever horizon reaches it
--     blank    name only. The axis slot exists; the lines simply stop
--
-- Blank rows are the point, not an oversight. Selecting a fiscal year we
-- cannot fully reach should show how far we can see and then stop, rather
-- than hiding the year or implying the months do not exist.
--
-- ── THE SIX-MONTH CAP IS NOT APPLIED HERE ───────────────────────────────────
--
-- get_sales_projections caps the published horizon at 6 (hcap). That cap was
-- set because C21 found h=12 unvalidatable -- a finding architecture §11h
-- RETRACTS: the backtest had been bounded to 30 months for performance, and
-- point-in-time testing took h=12 from 5 scoreable origins to 46, with band
-- coverage measuring 77-82% at every horizon.
--
-- Applying the cap here would make any future fiscal year almost entirely
-- blank. The bands widen with horizon on their own, and months past 6 are
-- counted into monthsBeyondValidated so the chart can disclose rather than
-- imply. Still true and still disclosed: §11h Finding 2 measured
-- seasonal_naive beating the blend at h=6 and h=12.
-- ############################################################################
cal as (
    select date_trunc('month', current_date)::date            as cur_month,
           extract(day from current_date)::numeric            as day_elapsed,
           extract(day from (date_trunc('month', current_date)
                             + interval '1 month - 1 day'))::numeric
                                                              as days_in_month
),

-- The spine. `name` is emitted HERE, not from a joined branch -- Recharts keys
-- its XAxis on `name`, so a blank month with a null name loses its slot
-- entirely and the axis silently shortens.
months as (
    select g::date                  as period_month,
           to_char(g, 'Mon YYYY')   as name
    from bounds b,
         generate_series(b.fy_start, b.fy_end_month, interval '1 month') g
),

-- No horizon filter: see the cap note above. `where blend > 0` inside the view
-- already drops degenerate rows, and those months land blank -- which is the
-- behaviour we want.
--
-- READS THE CACHE, NOT THE VIEW (2026-10-15).
--
-- This comment used to argue that `as materialized` was load-bearing BECAUSE
-- v_sales_projection_ensemble was not a materialized view -- it joined six
-- live views and measured 4,202 ms for twelve rows, and reading it twice in
-- one RPC timed this function out on first deploy.
--
-- private.mv_sales_projection_ensemble is now that cache. `as materialized` is
-- kept as cheap insurance rather than a necessity: the rule it encodes --
-- downstream CTEs read THIS, never the source again -- is what stopped the
-- double evaluation, and it should survive the source getting cheap.
--
-- ⚠ The cache can name the wrong month on the 1st until the 00:20 MYT job
-- fires. In this RPC that makes `fwd` and `cur_row` collide on one
-- period_month, breaking the disjointness the timeline CTE below relies on.
-- get_sales_projections publishes `ensembleCacheStale` for exactly this.
--
-- Everything downstream that needs a forward number -- nxt, cur_est, cur_row,
-- timeline, AND `years` -- reads this CTE. Nothing reads the cache again.
fwd as materialized (
    select e.period_month, e.horizon, e.projected,
           e.lo_80, e.hi_80, e.lo_95, e.hi_95, e.total_var
    from private.mv_sales_projection_ensemble e
),

nxt as (select * from fwd where horizon = 1),

cur_mtd as (
    select coalesce(max(s.value), 0) as v
    from public.v_sales_monthly_series s
    cross join cal c
    where s.measure = 'invoiced'
      and s.period_month = c.cur_month
),

-- Month-to-date plus the model's level for the days left. The ensemble's first
-- horizon is NEXT month, so the current one is not projected at all; counting
-- only what is banked would read almost a full month low on the 1st.
cur_est as (
    select cm.v
             + n.projected * ((c.days_in_month - c.day_elapsed) / c.days_in_month)
               as v,
           ((c.days_in_month - c.day_elapsed) / c.days_in_month) as frac_remaining
    from cur_mtd cm
    cross join cal c
    cross join nxt n
),

-- Narrower than a full month by construction: part of the month is banked, so
-- only the remaining fraction is uncertain. This is the one band in the chart
-- built from a lognormal rather than measured quantiles -- a one-month shape
-- change in the middle of the fan, stated here so it is not debugged later.
cur_row as (
    select c.cur_month as period_month,
           ce.v        as estimate,
           case when ce.v > 0
                 and (n.total_var * power(ce.frac_remaining, 2)) > 0
                then ln(1 + (n.total_var * power(ce.frac_remaining, 2))
                            / power(ce.v, 2)) end as sigma_sq
    from cal c
    cross join cur_est ce
    cross join nxt n
),

-- The three branches are DISJOINT by construction -- past is is_complete
-- (strictly before this month), cur_row is exactly this month, fwd starts at
-- h=1 (next month). The coalesce order below is therefore a safety net, not an
-- arbitration between competing claims.
timeline as (
    select m.period_month,
           m.name,

           -- Actual comes from the past branch ONLY. The current month's
           -- month-to-date is deliberately not plotted as an actual: on the
           -- 3rd that is three days of invoicing drawn against full months
           -- everywhere else, which reads as a collapse that did not happen.
           p.actual,

           coalesce(p.projected, c.estimate, f.projected)       as projected,

           -- Each bound pair is guarded as a PAIR. A one-sided band must be
           -- null, never [null, x] -- Recharts would try to draw it.
           coalesce(
               case when p.lo_80 is not null and p.hi_80 is not null
                    then json_build_array(round(p.lo_80), round(p.hi_80)) end,
               case when c.sigma_sq is not null
                    then json_build_array(
                           round(exp(ln(c.estimate) - c.sigma_sq / 2 - sqrt(c.sigma_sq) * 1.2816)),
                           round(exp(ln(c.estimate) - c.sigma_sq / 2 + sqrt(c.sigma_sq) * 1.2816))) end,
               case when f.lo_80 is not null and f.hi_80 is not null
                    then json_build_array(round(f.lo_80), round(f.hi_80)) end
           )                                                    as band80,

           coalesce(
               case when p.lo_95 is not null and p.hi_95 is not null
                    then json_build_array(round(p.lo_95), round(p.hi_95)) end,
               case when c.sigma_sq is not null
                    then json_build_array(
                           round(exp(ln(c.estimate) - c.sigma_sq / 2 - sqrt(c.sigma_sq) * 1.9600)),
                           round(exp(ln(c.estimate) - c.sigma_sq / 2 + sqrt(c.sigma_sq) * 1.9600))) end,
               case when f.lo_95 is not null and f.hi_95 is not null
                    then json_build_array(round(f.lo_95), round(f.hi_95)) end
           )                                                    as band95,

           p.source,
           f.horizon,
           p.error_pct,
           p.inside_80,

           case when p.period_month is not null then 'past'
                when c.period_month is not null then 'current'
                when f.period_month is not null then 'future'
                else 'blank' end                                as segment

    from months m
    left join rows_in_year p on p.period_month = m.period_month
    left join fwd          f on f.period_month = m.period_month
    left join cur_row      c on c.period_month = m.period_month
),

tl_agg as (
    select count(*) filter (where segment <> 'blank')                  as months_with_data,
           count(*) filter (where segment = 'future' and horizon > 6)  as months_beyond_validated,
           to_char(max(period_month) filter (where segment = 'past'),
                   'Mon YYYY')                                         as forecast_start_label
    from timeline
),

-- Which years the selector should offer. Derived from the data rather than
-- from the frontend's preset list, which runs back 11 years and would offer a
-- year that renders empty.
--
-- UNION, not UNION ALL, and over MONTHS rather than rows: the current fiscal
-- year has both scored past months and projected future ones, and counting
-- both would report 17 months in a 12-month year.
--
-- `having count(*) >= 2` keeps out a year reachable by a single far horizon --
-- standing in April 2027, FY2028-29 is touched by Apr 2028 at h=12 alone, and
-- one point is not a chart.
years as (
    select (extract(year from period_month)
            - case when extract(month from period_month) >= 4 then 0 else 1 end)::int
               as fy_start_year,
           count(*) as months_with_data
    from (
        -- Reads the CTEs, NOT the sources. Querying them here again cost a
        -- second full evaluation of both -- including the then-uncached
        -- six-live-view ensemble -- and timed this RPC out on first deploy.
        -- The ensemble is cached since 2026-10-15; the rule stands anyway. The two scans
        -- look free because the subquery only asks for one column; they are
        -- not, because the planner must build the whole view to produce it.
        select period_month from acc_h1
        union
        select period_month from fwd
    ) u
    group by 1
    having count(*) >= 2
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'fiscalYearLabel',        b.fy_label,
            'fiscalYearStart',        v_fy_start,

            -- how much evidence, and of which kind
            'monthsScored',           g.months_scored,
            'recordedMonths',         g.recorded_months,
            'reconstructedMonths',    g.reconstructed_months,
            'hasRecorded',            (g.recorded_months > 0),

            -- typical miss
            'typicalMissMyr',         round(g.mae),
            'typicalMissPct',         case when g.avg_actual > 0
                                           then round(100.0 * g.mae / g.avg_actual) end,

            -- did reality land inside the published range
            'bandCoveragePct',        case when g.banded_count > 0
                                           then round(100.0 * g.inside_count / g.banded_count) end,
            'bandCoverageTarget',     80,
            'bandedMonths',           g.banded_count,

            -- the year in total
            'yearForecastTotal',      round(g.total_projected),
            'yearActualTotal',        round(g.total_actual),
            'yearErrorPct',           case when g.total_actual > 0
                                           then round(100.0 * (g.total_projected - g.total_actual)
                                                      / g.total_actual, 1) end,

            -- ── the merged chart (2026-10-14) ──────────────────────────────
            --
            -- monthsWithData is NOT cosmetic. monthlyData is now a 12-row
            -- spine that is never empty, so the frontend's old emptiness test
            -- (`!monthlyData.length`) can never fire again -- a fully blank
            -- future year would render tiles full of nulls instead of
            -- NoResult. This key is what the section branches on.
            'monthsWithData',         t.months_with_data,

            -- Where the dashed "today" divider goes. Computed here so the
            -- rule is stated once; the frontend previously re-derived it by
            -- scanning for the last row with a non-null actual, which finds
            -- nothing at all on a future fiscal year.
            'forecastStartLabel',     t.forecast_start_label,

            -- Disclosure, mirroring fullYearMonthsBeyondValidated. The six-
            -- month cap is not applied to this chart; these months are the
            -- ones it exceeds it by.
            'monthsBeyondValidated',  t.months_beyond_validated,

            -- Was `horizonShown: 1`, which stopped being true the moment the
            -- chart gained forward months -- the past is h=1, the future is
            -- whatever horizon reaches that month.
            'pastHorizonShown',       1,
            'sourceView',             'v_sales_projection_accuracy + private.mv_sales_projection_ensemble'
        )
        from bounds b cross join agg g cross join tl_agg t
    ),

    -- Every month of the fiscal year, blanks included. Ordered by the SPINE's
    -- period_month -- never a joined nullable one, which would scatter the
    -- blank months wherever the sort felt like putting them.
    'monthlyData', (
        select coalesce(json_agg(
                   json_build_object(
                       'name',       t.name,
                       'segment',    t.segment,
                       'source',     t.source,
                       'projected',  round(t.projected),
                       'actual',     round(t.actual),
                       'band80',     t.band80,
                       'band95',     t.band95,
                       'horizon',    t.horizon,
                       'errorPct',   round(t.error_pct),
                       'insideBand', t.inside_80
                   ) order by t.period_month
               ), '[]'::json)
        from timeline t
    ),

    'availableYears', (
        select coalesce(json_agg(
                   json_build_object(
                       'startYear',      y.fy_start_year,
                       'label',          y.fy_start_year::text || '-' || (y.fy_start_year + 1)::text,
                       'monthsWithData', y.months_with_data
                   ) order by y.fy_start_year desc
               ), '[]'::json)
        from years y
    )

) into result;

return result;

end;
$$;


-- ############################################################################
-- VERIFY
--
--     select get_sales_projection_accuracy();              -- current FY
--     select get_sales_projection_accuracy(2024);          -- FY 2024-2025
--
-- Check, in this order:
--   1. `availableYears` is not empty -- if it is, the accuracy view has no
--      rows and nothing downstream will render.
--   2. `recordedMonths` is 0 today. Correct: no month has closed since the
--      first snapshot. It becomes 1 the month after.
--   3. `bandCoveragePct` lands near 80 and agrees with diagnostic C26a.
--   4. Call it as a non-SAL/MGM user: must raise 42501, not return data.
--   5. `monthlyData` is never null -- coalesce to '[]' means an empty year
--      renders NoResult rather than crashing the chart.
--
-- ── THE MERGED TIMELINE (2026-10-14) ────────────────────────────────────────
--
-- RUN THESE THREE FIRST, before trusting anything the chart draws.
--
--   A. The fan-out check. MUST return two equal numbers.
--
--        select count(*), count(distinct period_month)
--        from public.v_sales_projection_accuracy
--        where horizon = 1;
--
--      `timeline` LEFT JOINs that view onto a 12-row spine. A duplicate
--      (period_month, horizon) fans the join out and the chart gains repeated
--      months with no error raised anywhere.
--
--   B. The horizon identity the blank-month logic rests on.
--
--        select horizon, period_month
--        from public.v_sales_projection_ensemble
--        order by horizon;
--
--      Every row must satisfy
--        period_month = date_trunc('month', current_date) + horizon months.
--      Standing 2026-10-14 that is 2026-11 .. 2027-10, which is why FY2027-28
--      shows Apr-Oct 2027 and five blanks.
--
--   C. THE QUERY THAT VALIDATES DROPPING THE SIX-MONTH CAP.
--
--        select horizon, count(*)
--        from private.mv_sales_projection_ensemble_backtest
--        where estimator='ensemble' and window_months=12
--          and cl_weight_label='coverage(h)' and predicted>0
--        group by horizon order by horizon;
--
--      EVERY horizon must show >= 20. That is the guard on the ensemble
--      view's measured_quantiles; below it the band falls back to the
--      lognormal and the far end of the fan balloons. If any horizon is
--      short, reinstate a cap at the last horizon that clears 20.
--
-- Then:
--
--   6. select get_sales_projection_accuracy(2027);
--      12 rows. 7 with a non-null `projected`, 5 null except `name` and
--      `segment = 'blank'`. `monthsScored` is 0 and that is correct -- no
--      month of a future fiscal year has closed.
--
--   7. select get_sales_projection_accuracy(2024);
--      `monthsScored` UNCHANGED from before this migration. The regression
--      test that the 12-row spine did not leak into the aggregates.
--
--   8. Seam continuity. For the last closed month and the first forward
--      month, band80[0]/projected and band80[1]/projected must agree to 4
--      decimal places WHEN the closed month is `reconstructed` -- the two
--      band derivations are bit-identical (same mv, same filters, same
--      percentile_cont, same monotone guard).
--
--      They will DIFFER when the closed month is `recorded`, and that is
--      correct: a frozen snapshot keeps whatever configuration it was frozen
--      under. Any snapshot taken before 2026-10-14 carries a lognormal band
--      sized from the abandoned `smooth w(h)` weight. Do not "fix" it.
-- ############################################################################
