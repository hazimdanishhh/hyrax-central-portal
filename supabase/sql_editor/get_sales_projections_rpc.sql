-- ############################################################################
-- ⚠ DEPLOY ORDER MATTERS. RUN THIS WHOLE FILE AS ONE SUBMISSION.
--
-- This function GAINS A PARAMETER. `create or replace` cannot alter an
-- argument list, so the old zero-argument version must be dropped first. If
-- both exist, PostgREST sees two overloads of one name and refuses BOTH with
-- PGRST203 -- the section goes blank, not degraded.
--
-- The drop and the create are in the same file for exactly that reason. The
-- page 500s for the second or two between them.
--
-- AFTER the frontend is deployed, drop the function this one absorbs:
--
--     drop function if exists public.get_sales_projection_accuracy(int);
--
-- Not before -- the running frontend still calls it until the new bundle
-- ships.
-- ############################################################################

drop function if exists public.get_sales_projections();

create or replace function get_sales_projections(
    p_fiscal_year_start int default null
)
returns json
language plpgsql
-- SECURITY INVOKER (the default, written explicitly). NOT definer: the guard
-- below is an authorization check, not a privilege escalation, and the
-- caller's own grants are what let the underlying views and
-- sales_projection_snapshots resolve.
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
-- get_sales_projections -- backs the ENTIRE Projections section of Sales
-- Reports (src/pages/user/sales/reports/Reports.jsx).
--
-- §9 of docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md is the tile and chart
-- spec; §11 is the evidence behind every number here.
--
-- ── THE MERGE (2026-10-16) ──────────────────────────────────────────────────
--
-- This function absorbs get_sales_projection_accuracy(). Until today the
-- section ran on TWO CLOCKS: tiles 1-3 and both exhibit charts read this
-- function, which took no arguments and always described *now*; tile 4 and the
-- main chart read the accuracy function, which followed the section's year
-- dropdown. Choosing FY 2024-2025 left three tiles and two charts still
-- talking about November 2026.
--
-- One function, one fiscal year, one answer. The old split is why
-- `fanChartData` existed at all, and it goes with it.
--
-- ── NO SALESPERSON FILTER, STILL ────────────────────────────────────────────
--
-- Sales Reports carries a salesperson filter and a date range. Neither applies
-- here, and the fiscal-year parameter below is NOT the page's date filter --
-- it is the section's own dropdown.
--
-- The projection is company-wide by design -- architecture §"Permanently out
-- of scope" records why per-rep projections are not built: splitting an
-- already-lumpy series makes every sub-series lumpier, and §11 measured the
-- top three invoices at 31.2% of a typical month.
--
-- ── WHY kpis IS NESTED ──────────────────────────────────────────────────────
--
-- The two merged key sets are ~35 and ~33 keys. json_build_object takes at
-- most 100 ARGUMENTS -- 50 key/value pairs -- and raises 54023 past that.
-- A flat merge is ~136 arguments and will not compile.
--
-- So `kpis` is four sub-objects: year, month, reliability, health. The
-- frontend reads kpis.year.*, kpis.month.*, and so on. Adding a key is safe;
-- adding a fifth sub-object is safer than growing one past 50 pairs.
--
-- ── EVALUATE EACH HEAVY SOURCE EXACTLY ONCE ─────────────────────────────────
--
-- THE RULE: downstream CTEs read `acc_h1` and `fwd`, NEVER the views behind
-- them. A second reference to the view is a second full evaluation the planner
-- cannot share with the CTE -- which is what timed the accuracy RPC out on
-- first deploy, in `years`, and what the 4,202 ms ensemble measurement was.
-- Both `as materialized` markers are load-bearing. Do not remove them because
-- "the source is cached now".
--
-- ── WATCH-OUTS ──────────────────────────────────────────────────────────────
--
--   * Every array key uses coalesce(json_agg(...), '[]'::json), and
--     exhibitsByMonth uses coalesce(..., '{}'::json). A null where the
--     frontend expects a container is a render crash, not an empty chart.
--   * band80/band95 are TWO-ELEMENT ARRAYS. Recharts renders a ranged Area
--     from a tuple. CustomTooltip cannot format them -- FanChartTooltip exists
--     for this and FanChartRenderer must not fall back to the shared one.
--   * Month labels are emitted HERE. src/functions/formatDate.js has no month
--     formatter, and every existing monthly chart takes `name` verbatim.
--   * monthlyData carries BOTH `name` (display) and `periodMonth` (machine).
--     The chart's click target must come from the RPC, never from parsing
--     'Mon YYYY' client-side -- DASHBOARD-CONVENTIONS.md §4d.
-- ############################################################################

-- ─── Access guard ──────────────────────────────────────────────────────────
-- Stricter than get_sales_reports_dashboard's department-only guard, matching
-- get_finance_dashboard_rpc.sql instead, and for the reason that file states:
-- its source is a materialized view, which cannot carry RLS.
--
-- The same applies here. The caches live in `private`, which is not in
-- PostgREST's exposed list, so they are not REST-routable -- but this function
-- IS, so the gate has to be here.
--
-- Mirrors SalesRoutes.jsx's AccessRoute(departments:["SAL","MGM"],
-- roles:["manager"]). Raises rather than returning empty: an empty projection
-- looks like "no data" and would be read as a business fact.
select r.name, d.sub
  into v_role_name, v_department_sub
from profiles p
join roles r on r.id = p.role_id
join departments d on d.id = p.department_id
where p.id = auth.uid();

if v_role_name is distinct from 'superadmin'
   and not (v_role_name = 'manager' and v_department_sub in ('SAL', 'MGM'))
then
    raise exception 'Unauthorized: get_sales_projections requires SAL/MGM manager or superadmin'
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


with
-- ─── windows ───────────────────────────────────────────────────────────────
bounds as (
    select make_date(v_fy_start, 4, 1)                    as fy_start,
           make_date(v_fy_start + 1, 3, 1)                as fy_end_month,
           make_date(v_fy_start - 1, 4, 1)                as prior_fy_start,
           make_date(v_fy_start, 3, 1)                    as prior_fy_end_month,
           -- "2026-2027", matching FISCAL_YEAR_PRESETS' own label format so
           -- the tile reads identically to the page's other fiscal-year
           -- controls.
           v_fy_start::text || '-' || (v_fy_start + 1)::text  as fy_label
),

-- Day arithmetic for the current, part-invoiced month.
cal as (
    select date_trunc('month', current_date)::date            as cur_month,
           extract(day from current_date)::numeric            as day_elapsed,
           extract(day from (date_trunc('month', current_date)
                             + interval '1 month - 1 day'))::numeric
                                                              as days_in_month
),

-- Does the SELECTED fiscal year contain today? This one boolean decides the
-- shape of the whole response: whether there is a live month at all, whether
-- tile 3 is "This Month" or "Biggest Miss", and which month the exhibits
-- default to.
fy_meta as (
    select (c.cur_month >= b.fy_start and c.cur_month <= b.fy_end_month) as is_current_fy,
           (b.fy_end_month < c.cur_month)                                as is_past_fy
    from bounds b cross join cal c
),

hcap as (select 6 as cap),

-- ─── sources ───────────────────────────────────────────────────────────────
inv as (
    select period_month, value, is_complete
    from public.v_sales_monthly_series
    where measure = 'invoiced'
),

ord as (
    select period_month, value, is_complete
    from public.v_sales_monthly_series
    where measure = 'orders'
),

-- ############################################################################
-- THE TWO MATERIALIZED CTEs. See the banner above -- these are the reason this
-- function returns in milliseconds instead of timing out.
-- ############################################################################
acc_h1 as materialized (
    select a.*
    from public.v_sales_projection_accuracy a
    where a.horizon = 1
),

-- READS THE CACHE, NOT THE VIEW.
--
-- v_sales_projection_ensemble measured 4,202 ms to produce twelve rows.
-- private.mv_sales_projection_ensemble is the same twelve rows, pre-built by
-- refresh-sales-projection-ensemble-daily at 00:20 MYT.
--
-- ⚠ THE CACHE CAN NAME THE WRONG MONTH. period_month is derived from
-- current_date inside the model views, so a cache built last month says h=1 is
-- the month we are now IN -- which makes `fwd` and `cur_row` collide on one
-- period_month and breaks the disjointness `timeline` relies on.
-- kpis.health.ensembleCacheStale exists to report exactly that.
--
-- model_detail, implied_from_order_book and order_book_weight were added to
-- this select list on 2026-10-16 for exhibitsByMonth. They are the same
-- columns the snapshot table stores, in the same shape.
fwd as materialized (
    select e.period_month, e.horizon, e.projected,
           e.lo_80, e.hi_80, e.lo_95, e.hi_95, e.total_var,
           e.implied_from_order_book, e.implied_from_apriori,
           e.order_book_weight, e.model_detail,
           e.within_var, e.between_var, e.band_origins
    from private.mv_sales_projection_ensemble e
),

nxt as (select * from fwd where horizon = 1),

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

-- ── THE WORST SINGLE MONTH OF THE SELECTED YEAR (added 2026-10-16) ─────────
--
-- Tile 3 on any year that is not the current one. `agg` above gives the
-- AVERAGE miss; this gives the one that would have hurt. A manager reviewing a
-- closed year asks which month we got wrong, not what the mean was.
--
-- Ordered on abs_error, not error_pct: a 60% miss on a RM200k month is noise,
-- a 25% miss on a RM6M month is the one that moved the year.
biggest_miss as (
    select r.period_month,
           to_char(r.period_month, 'Mon YYYY') as name,
           r.projected,
           r.actual,
           r.abs_error,
           r.error_pct,
           r.inside_80,
           r.source
    from rows_in_year r
    where r.abs_error is not null
    order by r.abs_error desc
    limit 1
),

-- ─── fiscal-year build-up ──────────────────────────────────────────────────
-- Three parts, kept separate so the tile can show its own arithmetic and a
-- reader can check it:
--     closed actuals  +  current month estimate  +  projected remainder
--
-- All three generalise to ANY fiscal year without a branch:
--   * a PAST year has no current month inside it and no future months, so the
--     second and third parts are zero and outlook = actual;
--   * a FUTURE year has no closed months, so the first part is zero;
--   * the current year has all three.
-- The band collapses to null on a past year for the same reason -- there is no
-- variance to carry. Do not add `case when is_past_fy` guards; they would be
-- dead code that hides a real bug if one of these ever returns rows it should
-- not.
fy_actual as (
    select coalesce(sum(i.value), 0) as v
    from inv i
    cross join bounds b
    where i.is_complete
      and i.period_month >= b.fy_start
      and i.period_month <= b.fy_end_month
),

-- ── THE PLAN TO MEASURE THE FORECAST AGAINST ──────────────────────────────
--
-- Variance-to-plan is the question a finance review opens with, and a forecast
-- with no plan beside it cannot answer it. This is ALSO what lets tile 1 carry
-- the severity ramp: per DASHBOARD-CONVENTIONS.md §4 a tile earns colour only
-- with an inherent direction of "better" AND a comparator already in `kpis`.
-- A bare projection has neither -- revenue above forecast is not "good", it
-- means the forecast was low. Outlook against budget has both.
--
-- ── WHY NO PRORATION, AND NO REP FILTER ───────────────────────────────────
--
-- Shape lifted from get_sales_reports_dashboard_rpc.sql's `budget_by_month`
-- (its unprorated one), NOT its `budget_math`. budget_math prorates by day
-- overlap because that RPC answers an arbitrary date range; a whole fiscal
-- year has no partial months, so proration degenerates to 1.0. budget_math
-- also filters by v_sales_rep_code for the per-rep scorecard -- this figure is
-- company-wide, matching the projection it sits next to.
--
-- date_trunc defensively: budget_month is normalised to a month start by the
-- frontend (salesBudgetsMutations.js), not by a database constraint.
fy_budget as (
    select coalesce(sum(bg.budget_revenue), 0) as v
    from public.sales_budgets bg
    cross join bounds b
    where date_trunc('month', bg.budget_month)::date >= b.fy_start
      and date_trunc('month', bg.budget_month)::date <= b.fy_end_month
),

-- Month-to-date. is_complete is false for the current month by construction
-- (v_sales_monthly_series sets it as period_month < date_trunc('month', now)).
cur_mtd as (
    select coalesce(max(i.value), 0) as v
    from inv i
    cross join cal c
    where i.period_month = c.cur_month
),

-- MONTH-TO-DATE + RUN-RATE for the days remaining.
--
-- The ensemble's first horizon is NEXT month, so the current one is not
-- projected at all. Counting only what has been invoiced so far would make the
-- fiscal KPI climb visibly through every month and read almost a full month
-- low on the 1st. Projecting the whole month would need an h=0 the backtest
-- cannot validate -- and every horizon published here has measured accuracy
-- behind it.
--
-- So: take what is banked, and add the model's monthly level for the days
-- left. Standard practice, and it uses only a horizon that was actually
-- scored.
--
-- ZERO when the selected year does not contain today -- see fy_actual's note.
cur_est as (
    select case when fm.is_current_fy
                then cm.v + n.projected
                          * ((c.days_in_month - c.day_elapsed) / c.days_in_month)
                else 0 end                                         as v,
           case when fm.is_current_fy
                then ((c.days_in_month - c.day_elapsed) / c.days_in_month)
                else 0 end                                         as frac_remaining
    from cur_mtd cm
    cross join cal c
    cross join nxt n
    cross join fy_meta fm
),

fy_proj as (
    select coalesce(sum(f.projected), 0)                        as v,
           count(*)::int                                        as n_months,
           count(*) filter (where f.horizon > h.cap)::int        as n_beyond,
           coalesce(sum(f.total_var), 0)                        as var_sum
    from fwd f
    cross join bounds b
    cross join cal c
    cross join hcap h
    where f.period_month >  c.cur_month
      and f.period_month >= b.fy_start
      and f.period_month <= b.fy_end_month
),

-- ── the fiscal-year band, MEASURED where possible ──────────────────────────
-- Summing twelve monthly variances assumes the months are independent, and
-- C16 proved they are not -- in 20 of 22 months at least 4 of 5 models missed
-- in the SAME direction, because every model is a trailing-level model. An
-- independence assumption would understate the band badly.
--
-- So the span error is measured directly: the ensemble's own backtest, summed
-- over exactly as many horizons as this fiscal year has left, scored on the
-- total. This is the quantity C19 reported as ~10% for a six-month span.
span_origins as (
    select eb.origin_month,
           sum(eb.predicted)  as pred_total,
           sum(eb.actual)     as act_total,
           count(*)           as months_present
    from private.mv_sales_projection_ensemble_backtest eb
    cross join fy_proj fp
    where eb.estimator       = 'ensemble'
      and eb.window_months   = 12
      -- This filter must track sales_projection_ensemble_view.sql's
      -- measured_err / measured_quantiles CTEs. If the weight rule changes
      -- again, it changes in BOTH places or the band stops describing the
      -- number it surrounds. (It read a stale 'smooth w(h)' until 2026-10-14;
      -- the band was sized from a configuration the system had abandoned.)
      and eb.cl_weight_label = 'coverage(h)'
      and eb.horizon        <= fp.n_months
    group by eb.origin_month
),

span_err as (
    select sqrt(avg(power(so.pred_total - so.act_total, 2))) as rmse_total,
           count(*)::int                                    as origins
    from span_origins so
    cross join fy_proj fp
    where so.months_present = fp.n_months
      and fp.n_months > 0
    having count(*) >= 6
),

fy_total as (
    select b.fy_label,
           fa.v                                          as actual_to_date,
           ce.v                                          as current_month_est,
           fp.v                                          as projected_remainder,
           fa.v + ce.v + fp.v                            as outlook,
           fp.n_months,
           fp.n_beyond,
           -- Falls back to the independence assumption only when the backtest
           -- cannot reach this span length; bandBasis reports which was used.
           coalesce(se.rmse_total, sqrt(nullif(fp.var_sum, 0)))  as span_sd,
           se.origins                                    as span_origins_used,
           -- The part-month carries the same uncertainty as a full month,
           -- scaled by how much of it is still unknown.
           n.total_var * power(ce.frac_remaining, 2)      as cur_month_var
    from bounds b
    cross join fy_actual fa
    cross join cur_est ce
    cross join fy_proj fp
    cross join nxt n
    left join span_err se on true
),

fy_band as (
    select ft.*,
           coalesce(ft.span_sd, 0) * coalesce(ft.span_sd, 0)
             + coalesce(ft.cur_month_var, 0) as fy_var
    from fy_total ft
),

-- Lognormal, the same transform the ensemble itself uses. Right-skewed: the
-- downside is bounded by committed orders, the upside is a fat tail because
-- one large tender can land.
fy_interval as (
    select fb.*,
           case when fb.outlook > 0 and fb.fy_var > 0
                then ln(1 + fb.fy_var / power(fb.outlook, 2)) end as sigma_sq,
           -- The current month gets its OWN band, from the same cur_month_var
           -- that already feeds the fiscal-year variance above. Narrower than
           -- a full month's by construction -- frac_remaining squares down as
           -- the month fills, so on the 28th the range is nearly closed.
           case when fb.current_month_est > 0 and fb.cur_month_var > 0
                then ln(1 + fb.cur_month_var / power(fb.current_month_est, 2))
           end                                                    as cur_sigma_sq
    from fy_band fb
),

fy_final as (
    select fi.*,
           case when fi.sigma_sq is not null
                then exp(ln(fi.outlook) - fi.sigma_sq / 2 - sqrt(fi.sigma_sq) * 1.2816)
           end as fy_lo_80,
           case when fi.sigma_sq is not null
                then exp(ln(fi.outlook) - fi.sigma_sq / 2 + sqrt(fi.sigma_sq) * 1.2816)
           end as fy_hi_80,
           case when fi.cur_sigma_sq is not null
                then exp(ln(fi.current_month_est) - fi.cur_sigma_sq / 2
                         - sqrt(fi.cur_sigma_sq) * 1.2816)
           end as cur_lo_80,
           case when fi.cur_sigma_sq is not null
                then exp(ln(fi.current_month_est) - fi.cur_sigma_sq / 2
                         + sqrt(fi.cur_sigma_sq) * 1.2816)
           end as cur_hi_80
    from fy_interval fi
),

prior_fy_actual as (
    select coalesce(sum(i.value), 0) as v
    from inv i
    cross join bounds b
    where i.is_complete
      and i.period_month >= b.prior_fy_start
      and i.period_month <= b.prior_fy_end_month
),

-- ── WHAT WE SAID THIS MONTH WOULD BE, FROZEN LAST MONTH (2026-10-16) ───────
--
-- Tile 3's whole point: a live month judged against the number we actually
-- published for it, not against a figure recomputed today knowing how the
-- month has gone so far.
--
-- READS sales_projection_snapshots DIRECTLY, and cannot read
-- v_sales_projection_accuracy instead -- that view INNER JOINs actuals on
-- is_complete, so it has no row for a month still open. This is the one place
-- in the file that touches the snapshot table.
--
-- ⚠ NULL UNTIL 1 NOVEMBER 2026. The first snapshot was taken by hand on
-- 2026-10-14, so snapshot_month = 2026-10-01 and its h=1 target is November.
-- No frozen forecast for October exists and none can be created after the
-- fact -- the ensemble rebuilds itself from the data as it now stands, which
-- is the entire reason the snapshot table exists. The tile renders an em-dash
-- and starts working on its own.
cur_prior_fc as (
    select s.projected, s.lo_80, s.hi_80, s.snapshot_month
    from public.sales_projection_snapshots s
    cross join cal c
    cross join fy_meta fm
    where fm.is_current_fy
      and s.horizon      = 1
      and s.period_month = c.cur_month
    limit 1
),

-- ─── comparators ───────────────────────────────────────────────────────────
-- These describe NOW, not the selected fiscal year: trailing averages and
-- year-on-year movement as of today. They are published only when the
-- selected year contains today, and null otherwise -- a trailing-6-month
-- comparison rendered inside a tile labelled FY 2024-2025 would be read as
-- describing that year, which it does not.
trailing_inv as (
    select avg(q.value) as avg_3m
    from (select i.value from inv i where i.is_complete
          order by i.period_month desc limit 3) q
),

trailing_ord as (
    select avg(q.value) as avg_3m
    from (select o.value from ord o where o.is_complete
          order by o.period_month desc limit 3) q
),

-- Same six months, year on year -- the comparison behind §11g Finding 5, and
-- the C11 finding: orders up 43% while invoicing is down 35%. These two
-- percentages were the whole point of the retired "Order Book vs Invoicing
-- History" tile and move into tile 1 so the signal survives its removal.
yoy as (
    select
      (select coalesce(sum(o.value), 0) from ord o cross join cal c
        where o.is_complete and o.period_month >  (c.cur_month - interval '6 months')::date)
        as ord_recent,
      (select coalesce(sum(o.value), 0) from ord o cross join cal c
        where o.is_complete
          and o.period_month >  (c.cur_month - interval '18 months')::date
          and o.period_month <= (c.cur_month - interval '12 months')::date)
        as ord_prior,
      (select coalesce(sum(i.value), 0) from inv i cross join cal c
        where i.is_complete and i.period_month >  (c.cur_month - interval '6 months')::date)
        as inv_recent,
      (select coalesce(sum(i.value), 0) from inv i cross join cal c
        where i.is_complete
          and i.period_month >  (c.cur_month - interval '18 months')::date
          and i.period_month <= (c.cur_month - interval '12 months')::date)
        as inv_prior
),

last_year_same_month as (
    select coalesce(max(i.value), 0) as v
    from inv i
    cross join nxt n
    where i.period_month = (n.period_month - interval '12 months')::date
      and i.is_complete
),

-- ─── model agreement ───────────────────────────────────────────────────────
-- Expressed as spread rather than as the between/within split. "The models
-- agree within 12%" is a sentence a sales manager can act on; "between-model
-- variance is 18% of total" is not. Both are published -- the decomposition
-- still travels in the ensemble view for anyone who wants it.
agreement as (
    select n.period_month,
           n.projected,
           greatest(n.implied_from_order_book, max_ap.v)       as high_v,
           least(n.implied_from_order_book, min_ap.v)          as low_v
    from nxt n
    cross join lateral (
        select max((m->>'implied')::numeric) as v
        from jsonb_array_elements(n.model_detail->'apriori') m
    ) max_ap
    cross join lateral (
        select min((m->>'implied')::numeric) as v
        from jsonb_array_elements(n.model_detail->'apriori') m
    ) min_ap
),

-- ─── cache staleness ───────────────────────────────────────────────────────
-- The backtest caches in `private` are refreshed monthly by
-- snapshot-sales-projections-monthly. If a month closes and that job does not
-- fire, every number on this dashboard silently describes last month's world.
--
-- Detected from the data rather than from a timestamp table: compare the
-- newest month the cached scoring harness has scored against the newest month
-- the live series considers complete.
cache_state as (
    select
      (select max(period_month) from private.mv_sales_projection_baseline
        where measure = 'invoiced')                                as cache_latest,
      (select max(period_month) from inv where is_complete)        as series_latest
),

-- ─── ensemble cache staleness -- a DIFFERENT failure ───────────────────────
--
-- cache_state above is a MONTH-ROLLOVER detector. It is structurally blind to
-- the failure the forward cache introduces: a daily job that dies silently.
-- The four backtest caches can be probed from their own data because
-- max(period_month) of scored history IS a watermark. The twelve FORWARD rows
-- have no such marker, which is why the cache carries cache_refreshed_at.
--
-- Two probes, because they catch different things:
--   h1_month  -- the cache was built in a previous MONTH, so it names the
--               wrong month for horizon 1. This is the silent-drop fault.
--   age_hours -- the cache is from this month but the job has not run for
--               days. Only cache_refreshed_at can see this.
--
-- `is distinct from`, not `<>`: `where f.blend > 0` in the ensemble can drop
-- the h=1 row entirely, and with `<>` that yields null, which the frontend
-- banner reads as "fine".
ens_cache_state as (
    select
      (select max(e.period_month) from private.mv_sales_projection_ensemble e
        where e.horizon = 1)                                       as ens_h1_month,
      (date_trunc('month', current_date) + interval '1 month')::date
                                                                   as ens_h1_expected,
      (select max(e.cache_refreshed_at)
         from private.mv_sales_projection_ensemble e)              as ens_refreshed_at
),

-- ############################################################################
-- THE FISCAL-YEAR TIMELINE
--
-- One row per month of the selected fiscal year, always twelve:
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
-- kpis.health.publishedHorizonCap is 6. That cap was set because C21 found
-- h=12 unvalidatable -- a finding architecture §11h RETRACTS: the backtest had
-- been bounded to 30 months for performance, and point-in-time testing took
-- h=12 from 5 scoreable origins to 46, with band coverage measuring 77-82% at
-- every horizon.
--
-- Applying the cap here would make any future fiscal year almost entirely
-- blank. The bands widen with horizon on their own, and months past 6 are
-- counted into monthsBeyondValidated so the chart can disclose rather than
-- imply. Still true and still disclosed: §11h Finding 2 measured
-- seasonal_naive beating the blend at h=6 and h=12.
-- ############################################################################

-- The spine. `name` is emitted HERE, not from a joined branch -- Recharts keys
-- its XAxis on `name`, so a blank month with a null name loses its slot
-- entirely and the axis silently shortens.
months as (
    select g::date                  as period_month,
           to_char(g, 'Mon YYYY')   as name
    from bounds b,
         generate_series(b.fy_start, b.fy_end_month, interval '1 month') g
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
    cross join fy_meta fm
    where fm.is_current_fy
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

-- ############################################################################
-- exhibitsByMonth -- WHAT THE MODEL SAID, FOR EVERY MONTH OF THE YEAR
--
-- The two exhibit charts used to describe next month and nothing else.
-- Clicking a month on the main chart now re-points them, so both need a value
-- for every month of the selected year.
--
-- All twelve are sent in one payload rather than refetched per click. Twelve
-- months x ~5 rows is nothing, and a click that costs a round trip does not
-- feel like a selection.
--
-- ── THREE SOURCES, DISJOINT BY MONTH ───────────────────────────────────────
--
--   period_month >  cur_month   LIVE      the forward cache, at that month's
--                                         own horizon
--   period_month <  cur_month   SNAPSHOT  if one was frozen for it, else
--                                         REBUILT from the backtest
--   period_month =  cur_month   NONE      the current month is month-to-date
--                                         plus a run rate, not a model output.
--                                         There is no per-model breakdown to
--                                         show and inventing one would imply
--                                         the models were consulted.
--
-- `basis` travels with every month so the chart subtitle can say which. A
-- rebuilt month is a weaker claim than a published one -- the same distinction
-- v_sales_projection_accuracy already draws between recorded and
-- reconstructed, and it must never be hidden.
-- ############################################################################

-- LIVE and SNAPSHOT share a shape: both carry model_detail in the jsonb form
-- sales_projection_ensemble_view.sql builds, plus the three scalars the
-- build-up needs. snapshot_sales_projections() stores model_detail as a
-- straight pass-through of the same column, so this union is safe.
ex_live as (
    select f.period_month,
           f.projected,
           f.implied_from_order_book,
           f.order_book_weight,
           f.model_detail,
           'live'::text as basis
    from fwd f
    cross join bounds b
    cross join cal c
    where f.period_month >  c.cur_month
      and f.period_month >= b.fy_start
      and f.period_month <= b.fy_end_month
),

ex_snap as (
    select s.period_month,
           s.projected,
           s.implied_from_order_book,
           s.order_book_weight,
           s.model_detail,
           'as published'::text as basis
    from public.sales_projection_snapshots s
    cross join bounds b
    cross join cal c
    where s.horizon       = 1
      and s.period_month  <  c.cur_month
      and s.period_month  >= b.fy_start
      and s.period_month  <= b.fy_end_month
),

-- EXPLICIT COLUMN LISTS, NOT `select *`. UNION ALL matches by POSITION, and
-- this project has already lost a day to that: v_sales_projection_calibration
-- unioned two CTEs with `select *` whose columns were in opposite orders, an
-- origin COUNT landed in a bias column, and the chain-ladder factor became
-- 1 + 24 = 25. Naming the columns makes a future reorder a compile error
-- instead of a wrong number.
ex_md as (
    select period_month, projected, implied_from_order_book,
           order_book_weight, model_detail, basis
    from ex_live
    union all
    select period_month, projected, implied_from_order_book,
           order_book_weight, model_detail, basis
    from ex_snap
),

-- ── THE REBUILT BRANCH ─────────────────────────────────────────────────────
--
-- Months that closed before snapshots existed. Every figure comes from
-- private.mv_sales_projection_ensemble_backtest at h=1, window 12, rebuilt
-- point-in-time -- no row here was fitted on the month it is predicting.
--
-- ⚠ TWO TRAPS, BOTH LOAD-BEARING:
--
-- 1. cl_weight EXISTS ONLY ON THE ENSEMBLE ROW. Member rows carry
--    cl_weight_label = 'n/a' and a null weight, because the weight sweep does
--    not touch them -- they are emitted once per origin, not once per grid
--    point. So the predicate below must NOT filter members on the label.
--    `cl_weight_label = 'coverage(h)'` applied to the whole set returns the
--    ensemble row and nothing else.
--
-- 2. THE MODEL NAMES DIFFER FROM model_detail's. The backtest emits
--    'ma12' and 'ses_020'; model_detail->'apriori' emits 'baseline' and 'ses'.
--    Two of three do not overlap. The display names below are mapped from the
--    BACKTEST set and must match the mapping used for ex_md, or the same model
--    gets two different bar labels depending on which month you clicked.
--
-- seasonal_naive is in the backtest and NOT in model_detail. Excluded on
-- purpose: including it would make a month's bars depend on its source.
ex_bt as (
    select e.target_month                                                  as period_month,
           max(e.predicted) filter (where e.estimator = 'ensemble')        as blend,
           max(e.cl_weight) filter (where e.estimator = 'ensemble')        as cl_weight,
           max(e.predicted) filter (where e.estimator = 'chainladder')     as cl_implied,
           max(e.predicted) filter (where e.estimator = 'ma12')            as v_ma12,
           max(e.predicted) filter (where e.estimator = 'freqsev')         as v_freqsev,
           max(e.predicted) filter (where e.estimator = 'ses_020')         as v_ses
    from private.mv_sales_projection_ensemble_backtest e
    cross join bounds b
    cross join cal c
    where e.horizon        = 1
      and e.window_months  = 12
      and e.target_month   <  c.cur_month
      and e.target_month   >= b.fy_start
      and e.target_month   <= b.fy_end_month
      and e.estimator in ('ensemble', 'chainladder', 'ma12', 'freqsev', 'ses_020')
      -- See trap 1. The label pins the ensemble row only.
      and (e.estimator <> 'ensemble' or e.cl_weight_label = 'coverage(h)')
      and not exists (select 1 from ex_snap s where s.period_month = e.target_month)
    group by e.target_month
    having max(e.predicted) filter (where e.estimator = 'ensemble') is not null
),

-- One flat row set, pivoted into two arrays per month at the end. `kind`
-- separates the two charts; `sort_order` reproduces the ordering the old
-- single-month exhibits used.
exhibit_rows as (
    -- ── methods, from model_detail ──
    select x.period_month, x.basis, 'method'::text as kind,
           'Order Book (chain-ladder)'::text as name,
           round(x.implied_from_order_book) as value,
           false as is_blend, 1 as sort_order
    from ex_md x

    union all

    select x.period_month, x.basis, 'method',
           case m->>'model'
             when 'baseline' then 'Trailing Mean (ma12)'
             when 'freqsev'  then 'Frequency x Severity'
             when 'ses'      then 'Exponential Smoothing'
             else m->>'model'
           end,
           round((m->>'implied')::numeric),
           false, 2
    from ex_md x, jsonb_array_elements(x.model_detail->'apriori') m

    union all

    select x.period_month, x.basis, 'method',
           'Blend (published)', round(x.projected), true, 3
    from ex_md x

    -- ── methods, rebuilt ──
    union all
    select x.period_month, 'rebuilt afterwards', 'method',
           'Order Book (chain-ladder)', round(x.cl_implied), false, 1
    from ex_bt x where x.cl_implied is not null
    union all
    select x.period_month, 'rebuilt afterwards', 'method',
           'Trailing Mean (ma12)', round(x.v_ma12), false, 2
    from ex_bt x where x.v_ma12 is not null
    union all
    select x.period_month, 'rebuilt afterwards', 'method',
           'Frequency x Severity', round(x.v_freqsev), false, 2
    from ex_bt x where x.v_freqsev is not null
    union all
    select x.period_month, 'rebuilt afterwards', 'method',
           'Exponential Smoothing', round(x.v_ses), false, 2
    from ex_bt x where x.v_ses is not null
    union all
    select x.period_month, 'rebuilt afterwards', 'method',
           'Blend (published)', round(x.blend), true, 3
    from ex_bt x

    -- ── build-up, from model_detail ──
    -- The two shares sum EXACTLY to the blend by construction. The statistical
    -- share is the blend MINUS the order-book share, never
    -- (1 - weight) * apriori: that is the same number by algebra but it
    -- divides by (1 - weight), which is zero at a weight of 1.0.
    union all
    select x.period_month, x.basis, 'buildup',
           'From Order Book',
           round(x.order_book_weight * x.implied_from_order_book), false, 1
    from ex_md x
    union all
    select x.period_month, x.basis, 'buildup',
           'From Statistical Models',
           round(x.projected - x.order_book_weight * x.implied_from_order_book), false, 2
    from ex_md x
    union all
    select x.period_month, x.basis, 'buildup',
           'Projected Total', round(x.projected), false, 3
    from ex_md x

    -- ── build-up, rebuilt ──
    union all
    select x.period_month, 'rebuilt afterwards', 'buildup',
           'From Order Book', round(x.cl_weight * x.cl_implied), false, 1
    from ex_bt x where x.cl_weight is not null and x.cl_implied is not null
    union all
    select x.period_month, 'rebuilt afterwards', 'buildup',
           'From Statistical Models',
           round(x.blend - x.cl_weight * x.cl_implied), false, 2
    from ex_bt x where x.cl_weight is not null and x.cl_implied is not null
    union all
    select x.period_month, 'rebuilt afterwards', 'buildup',
           'Projected Total', round(x.blend), false, 3
    from ex_bt x
),

exhibits as (
    select er.period_month,
           min(er.basis)                                              as basis,
           coalesce(json_agg(json_build_object(
                        'name', er.name, 'value', er.value, 'isBlend', er.is_blend)
                    order by er.sort_order, er.value desc)
                    filter (where er.kind = 'method'), '[]'::json)    as methods,
           coalesce(json_agg(json_build_object(
                        'name', er.name, 'value', er.value)
                    order by er.sort_order)
                    filter (where er.kind = 'buildup'), '[]'::json)   as build_up
    from exhibit_rows er
    group by er.period_month
),

-- Which month the section opens on, decided HERE rather than in React. §4d's
-- principle: a chart's selection comes from the RPC, so the tile and the
-- exhibits can never disagree about which month they describe.
--
-- Next month when the selected year contains today -- that is the number the
-- section exists to publish. Otherwise the last month of that year we know
-- anything about, which for a closed year is March and for a future year is
-- as far as the horizon reaches.
default_exhibit as (
    select coalesce(
             (select n.period_month from nxt n cross join fy_meta fm
               cross join bounds b
               where fm.is_current_fy
                 and n.period_month >= b.fy_start
                 and n.period_month <= b.fy_end_month),
             (select max(x.period_month) from exhibits x)
           ) as period_month
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
        -- second full evaluation of both and timed this RPC out on first
        -- deploy. The scans look free because the subquery asks for one
        -- column; they are not, because the planner must build the whole view
        -- to produce it.
        select period_month from acc_h1
        union
        select period_month from fwd
    ) u
    group by 1
    having count(*) >= 2
)

select json_build_object(

    -- ── NESTED, because a flat merge is 136 arguments and the limit is 100.
    --    See the banner. Each sub-object must stay under 50 key/value pairs.
    'kpis', json_build_object(

        -- ─── TILE 1: the fiscal year ───────────────────────────────────────
        'year', (
            select json_build_object(
                'fiscalYearLabel',                b.fy_label,
                'fiscalYearStart',                v_fy_start,
                'isCurrentFiscalYear',            fm.is_current_fy,
                'isPastFiscalYear',               fm.is_past_fy,

                'outlook',                        round(f.outlook),
                'actualToDate',                   round(f.actual_to_date),
                'currentMonthEstimate',           round(f.current_month_est),
                'projectedRemainder',             round(f.projected_remainder),
                'lo80',                           round(f.fy_lo_80),
                'hi80',                           round(f.fy_hi_80),
                'monthsProjected',                f.n_months,
                'monthsBeyondValidated',          f.n_beyond,

                -- Attainment is NULL, never 0, when no budget exists for the
                -- year. A zero would read as "0% of budget" and paint the tile
                -- red for a year nobody has budgeted; null makes the tile fall
                -- back to informational blue, which getStatusVariant does on
                -- its own ("it never guesses a tier for missing data").
                'budget',                         round(bg.v),
                'budgetAttainmentPct',            case when bg.v > 0
                                                       then round(100.0 * f.outlook / bg.v) end,

                'priorYearActual',                round(pfy.v),
                'vsPriorYearPct',                 case when pfy.v > 0
                                                       then round(100.0 * f.outlook / pfy.v - 100, 1) end,

                -- What the forecast said for this year against what landed.
                -- Only meaningful once months have closed; on the current year
                -- it covers the closed months only, which is why it sits
                -- beside monthsScored rather than beside outlook.
                'forecastTotalScored',            round(ag.total_projected),
                'actualTotalScored',              round(ag.total_actual),
                'scoredErrorPct',                 case when ag.total_actual > 0
                                                       then round(100.0 * (ag.total_projected - ag.total_actual)
                                                                  / ag.total_actual, 1) end,

                -- The C11 finding, inherited from the retired Order Book vs
                -- Invoicing History tile. Trailing six months against the same
                -- six a year earlier -- a FIXED-WINDOW figure describing NOW,
                -- so it is null on any year that does not contain today.
                'ordersYoyPct',                   case when fm.is_current_fy and y.ord_prior > 0
                                                       then round(100.0 * y.ord_recent / y.ord_prior - 100, 0) end,
                'invoicedYoyPct',                 case when fm.is_current_fy and y.inv_prior > 0
                                                       then round(100.0 * y.inv_recent / y.inv_prior - 100, 0) end
            )
            from fy_final f
            cross join bounds b
            cross join fy_meta fm
            cross join fy_budget bg
            cross join prior_fy_actual pfy
            cross join agg ag
            cross join yoy y
        ),

        -- ─── TILES 2 AND 3: months ─────────────────────────────────────────
        -- Tile 2 reads monthlyData client-side for whichever month is
        -- selected -- every field it needs (projected, actual, band80,
        -- errorPct, insideBand, source, horizon) is already a column there, so
        -- clicking a month costs no refetch and the tile can never disagree
        -- with the chart it was clicked on.
        --
        -- What is NOT in monthlyData is published here: the next-month
        -- comparators, which only make sense for h=1, and the two tile-3
        -- variants.
        'month', (
            select json_build_object(
                'nextLabel',                  to_char(n.period_month, 'Mon YYYY'),
                'nextPeriodMonth',            n.period_month,
                'nextProjected',              round(n.projected),
                'nextLo80',                   round(n.lo_80),
                'nextHi80',                   round(n.hi_80),
                'nextOrderBookWeightPct',     round(100.0 * n.order_book_weight, 0),
                'nextVsTrailing3mPct',        case when ti.avg_3m > 0
                                                   then round(100.0 * n.projected / ti.avg_3m - 100, 0) end,
                'nextVsLastYearPct',          case when lysm.v > 0
                                                   then round(100.0 * n.projected / lysm.v - 100, 0) end,

                -- Two ways of estimating the SAME next-month figure. Retired
                -- as a tile, kept as data: the gap is what tells a reader
                -- whether the order book and invoicing history agree.
                'nextOrderBookImplied',       round(n.implied_from_order_book),
                'nextAprioriImplied',         round(n.implied_from_apriori),
                'nextModelSpreadPct',         case when a.projected > 0
                                                   then round(100.0 * (a.high_v - a.low_v) / a.projected, 0) end,

                -- ── TILE 3, variant A: the live month ──
                'currentLabel',               case when fm.is_current_fy
                                                   then to_char(c.cur_month, 'Mon YYYY') end,
                'currentPeriodMonth',         case when fm.is_current_fy then c.cur_month end,
                'currentMtdActual',           case when fm.is_current_fy then round(cm.v) end,
                'currentEstimate',            case when fm.is_current_fy
                                                   then round(f.current_month_est) end,
                'currentLo80',                round(f.cur_lo_80),
                'currentHi80',                round(f.cur_hi_80),
                'currentDayElapsed',          case when fm.is_current_fy then c.day_elapsed end,
                'currentDaysInMonth',         case when fm.is_current_fy then c.days_in_month end,
                -- Null until 1 Nov 2026. See the cur_prior_fc banner.
                'currentPriorForecast',       round(pf.projected),
                'currentVsPriorForecastPct',  case when pf.projected > 0
                                                   then round(100.0 * f.current_month_est
                                                              / pf.projected - 100, 0) end,
                'currentPriorForecastFrom',   to_char(pf.snapshot_month, 'Mon YYYY'),

                -- ── TILE 3, variant B: the year's worst month ──
                'biggestMissLabel',           bm.name,
                'biggestMissPeriodMonth',     bm.period_month,
                'biggestMissProjected',       round(bm.projected),
                'biggestMissActual',          round(bm.actual),
                'biggestMissMyr',             round(bm.abs_error),
                'biggestMissPct',             round(bm.error_pct),
                'biggestMissInsideBand',      bm.inside_80,
                'biggestMissSource',          bm.source
            )
            from nxt n
            cross join cal c
            cross join fy_meta fm
            cross join cur_mtd cm
            cross join fy_final f
            cross join trailing_inv ti
            cross join last_year_same_month lysm
            cross join agreement a
            left join cur_prior_fc pf on true
            left join biggest_miss bm on true
        ),

        -- ─── TILE 4: how much to trust any of this ─────────────────────────
        'reliability', (
            select json_build_object(
                'monthsScored',           ag.months_scored,
                'recordedMonths',         ag.recorded_months,
                'reconstructedMonths',    ag.reconstructed_months,
                'hasRecorded',            (ag.recorded_months > 0),

                -- MAE over the mean actual -- a WAPE, not a MAPE. The typical
                -- month's miss as a share of the typical month's revenue, not
                -- the average of per-month percentages, which one small month
                -- would dominate.
                'typicalMissMyr',         round(ag.mae),
                'typicalMissPct',         case when ag.avg_actual > 0
                                               then round(100.0 * ag.mae / ag.avg_actual) end,

                -- Did reality land inside the published range. 80% is the aim
                -- in BOTH directions -- well above it is also a failure,
                -- because a range that is never wrong is too wide to be
                -- useful.
                'bandCoveragePct',        case when ag.banded_count > 0
                                               then round(100.0 * ag.inside_count / ag.banded_count) end,
                'bandCoverageTarget',     80,
                'bandedMonths',           ag.banded_count
            )
            from agg ag
        ),

        -- ─── provenance and health ─────────────────────────────────────────
        -- Surfaced as plain keys so the frontend can explain itself rather
        -- than render a confident-looking wrong number. Same convention as
        -- get_sales_reports_dashboard's ownerSapMappingMissing.
        'health', (
            select json_build_object(
                'monthsWithData',         t.months_with_data,
                'forecastStartLabel',     t.forecast_start_label,
                'monthsBeyondValidated',  t.months_beyond_validated,
                'publishedHorizonCap',    h.cap,
                'bandOriginsAtH1',        n.band_origins,
                'spanOriginsUsed',        f.span_origins_used,
                'bandBasis',              case when f.span_origins_used is not null
                                               then 'measured span error'
                                               else 'summed monthly variance' end,
                'currentMonthEstimateBasis',
                    'month-to-date actual + model level pro-rated over days remaining',
                'cacheLatestMonth',       cs.cache_latest,
                'seriesLatestCompleteMonth', cs.series_latest,

                -- OR'd, deliberately, so the frontend banner fires for either
                -- failure. The keys below say which one it was; the banner
                -- text covers both because both mean "these figures describe
                -- an older world than you think".
                'cacheStale',             (cs.cache_latest is distinct from cs.series_latest)
                                          or (ecs.ens_h1_month is distinct from ecs.ens_h1_expected),
                'ensembleCacheH1Month',   ecs.ens_h1_month,
                'ensembleCacheExpectedH1Month', ecs.ens_h1_expected,
                'ensembleCacheStale',     (ecs.ens_h1_month is distinct from ecs.ens_h1_expected),
                'ensembleCacheAgeHours',  case when ecs.ens_refreshed_at is not null
                                               then round(extract(epoch from
                                                    (now() - ecs.ens_refreshed_at))::numeric / 3600, 1) end,
                'sourceView',             'private.mv_sales_projection_ensemble'
            )
            from tl_agg t
            cross join hcap h
            cross join nxt n
            cross join fy_final f
            cross join cache_state cs
            cross join ens_cache_state ecs
        )
    ),

    -- ── the chart, and the source tile 2 reads ─────────────────────────────
    -- periodMonth is NEW and load-bearing: it is the click target. §4d
    -- requires it to come from here rather than be parsed back out of
    -- 'Mon YYYY' in React.
    'monthlyData', (
        select coalesce(json_agg(
                   json_build_object(
                       'periodMonth', t.period_month,
                       'name',        t.name,
                       'segment',     t.segment,
                       'source',      t.source,
                       'projected',   round(t.projected),
                       'actual',      round(t.actual),
                       'band80',      t.band80,
                       'band95',      t.band95,
                       'horizon',     t.horizon,
                       -- Single-argument round, matching what this key emitted
                       -- before the merge. Postgres has no
                       -- round(double precision, int) -- only round(numeric,
                       -- int) -- and error_pct arrives from a division chain
                       -- whose type is not worth betting on.
                       'errorPct',    round(t.error_pct),
                       'insideBand',  t.inside_80
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
    ),

    -- Keyed by period_month as 'YYYY-MM-DD' so the frontend can look up the
    -- clicked month directly. '{}' not '[]' -- it is an object, and a null
    -- here is a render crash.
    'exhibitsByMonth', (
        select coalesce(json_object_agg(
                   x.period_month::text,
                   json_build_object(
                       'basis',   x.basis,
                       'methods', x.methods,
                       'buildUp', x.build_up
                   )
               ), '{}'::json)
        from exhibits x
    ),

    'defaultExhibitMonth', (select de.period_month from default_exhibit de)

) into result;

return result;

end;
$$;


-- ############################################################################
-- VERIFY
--
--     select get_sales_projections();                -- current FY
--     select get_sales_projections(2024);            -- a closed FY
--     select get_sales_projections(2027);            -- a future FY
--
-- Check, in this order:
--
--   1. NO PGRST203. The drop at the top of this file must have removed the
--      zero-argument overload. From the SQL editor:
--
--        select p.oid::regprocedure
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'get_sales_projections';
--
--      Exactly ONE row, reading get_sales_projections(integer).
--
--   2. kpis.year reconciles on the current FY:
--        actualToDate + currentMonthEstimate + projectedRemainder = outlook
--      The three parts are published separately precisely so this is
--      checkable by eye. On a CLOSED year, outlook = actualToDate and the
--      other two are 0.
--
--   3. kpis.year.budget is NON-ZERO for a year that has one. Cross-check:
--
--        select sum(budget_revenue)
--        from sales_budgets
--        where date_trunc('month', budget_month)::date
--              between make_date(2026, 4, 1) and make_date(2027, 3, 1);
--
--      The two must match exactly. If the RPC reads 0 while the table has
--      rows, the fiscal-year window is wrong.
--
--   4. No array key returns null, and exhibitsByMonth returns {} not null.
--
--   5. kpis.health.cacheStale is false. If true, run:
--        select public.refresh_sales_projection_caches();
--
--   6. kpis.health.bandBasis reads 'measured span error'. 'summed monthly
--      variance' means the backtest could not reach this span length and the
--      band assumes independent months, which C16 showed they are not.
--
--   7. EXHIBIT ARITHMETIC, every month. For each key in exhibitsByMonth:
--        buildUp[From Order Book] + buildUp[From Statistical Models]
--          = buildUp[Projected Total]
--      exactly, and Projected Total = the methods row flagged isBlend.
--      A mismatch on a 'rebuilt afterwards' month means the cl_weight join
--      picked up the wrong grid point.
--
--   8. EXHIBIT BAR NAMES ARE THE SAME FIVE ON EVERY MONTH. Different names on
--      a rebuilt month than on a live one means the ma12/baseline mapping
--      drifted:
--
--        select distinct jsonb_array_elements(v->'methods')->>'name'
--        from jsonb_each((get_sales_projections()->>'exhibitsByMonth')::jsonb) as t(k, v);
--
--      Five rows, no 'ma12', no 'ses_020', no 'seasonal_naive'.
--
--   9. kpis.month.currentPriorForecast is NULL before 2026-11-01 and NON-NULL
--      after. It cannot be backfilled -- see the cur_prior_fc banner.
--
--  10. TIMING. `explain analyze` must not regress past what
--      get_sales_projection_accuracy measured before the merge. A large jump
--      means a CTE lost its `as materialized` and is being evaluated twice.
-- ############################################################################
