create or replace function get_sales_projections()
returns json
language plpgsql
-- SECURITY INVOKER (the default, written explicitly). NOT definer: the guard
-- below is an authorization check, not a privilege escalation, and the caller's
-- own grants are what let the underlying views resolve. See the access-guard
-- note after `begin`.
security invoker
as
$$
declare
    result json;
    v_role_name       text;
    v_department_sub  text;
begin

-- ############################################################################
-- get_sales_projections -- backs the Projections section of Sales Reports
-- (src/pages/user/sales/reports/Reports.jsx).
--
-- Phase D of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md. §9 of
-- docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md is the tile and chart spec;
-- §11g is the evidence behind every number here.
--
-- ── NO PARAMETERS, DELIBERATELY ─────────────────────────────────────────────
--
-- Sales Reports carries a salesperson filter and a date range. Neither applies
-- here. The projection is company-wide by design -- §"Permanently out of scope"
-- records why per-rep projections are not built: splitting an already-lumpy
-- series makes every sub-series lumpier, and §11 measured the top three
-- invoices at 31.2% of a typical month.
--
-- A filter that silently does nothing is worse than one that is absent, so the
-- page section states this in its subtitle, the same way existing FIXED-WINDOW
-- charts say "Trailing 12 Months -- not affected by the date filter".
--
-- ── THE ONE SOURCE ──────────────────────────────────────────────────────────
--
-- v_sales_projection_ensemble, plus v_sales_monthly_series for history. Both
-- read the three caches in `private` (see sales_projection_materialization.sql),
-- so this RPC does not rebuild a backtest on every page load -- which is
-- exactly what it did before Phase C's final pass, and it timed out.
--
-- ── HORIZON CAP ─────────────────────────────────────────────────────────────
--
-- The ensemble emits h = 1..12. This publishes SIX. C21 proved h=12 cannot be
-- validated from the data that exists: the maximum prior scored origins
-- available at that horizon is 5 against a guard of 6, and relaxing the guard
-- would buy exactly one origin. h=7-8 are thin (10 and 8 origins), h=9-11
-- untrustworthy (6, 4, 2).
--
-- The cap will LIFT on its own as months close -- each one adds an origin at
-- every horizon -- so this is a constant to revisit, not a permanent ceiling.
--
-- The fiscal-year total is the one place horizons past the cap are used, and
-- only when the remaining year is longer than six months (April to July). Those
-- months are COUNTED and reported as `fullYearMonthsBeyondValidated` so the
-- tile can say so rather than implying the whole figure is equally sound.
--
-- ── WATCH-OUTS ──────────────────────────────────────────────────────────────
--
--   * Every array key uses coalesce(json_agg(...), '[]'::json). A null where
--     the frontend expects an array is a render crash, not an empty chart.
--   * band80/band95 are TWO-ELEMENT ARRAYS. Recharts renders a ranged Area
--     from a tuple. CustomTooltip cannot format them -- FanChartTooltip exists
--     for this and FanChartRenderer must not fall back to the shared one.
--   * Month labels are emitted HERE. src/functions/formatDate.js has no month
--     formatter, and every existing monthly chart takes `name` verbatim.
-- ############################################################################

-- ─── Access guard ──────────────────────────────────────────────────────────
-- Stricter than get_sales_reports_dashboard's department-only guard, matching
-- get_finance_dashboard_rpc.sql instead, and for the reason that file states:
-- its source is a materialized view, which cannot carry RLS.
--
-- The same applies here. v_sales_projection_ensemble is security_invoker, but
-- it reads private.mv_* materialized views, and an MV has no RLS at all. The
-- `private` schema is not in PostgREST's exposed list so the caches are not
-- REST-routable, but this function IS -- so the gate has to be here.
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


with
-- ─── windows ───────────────────────────────────────────────────────────────
-- Fiscal year, April-March. The expression is the same one used by
-- get_sales_reports_dashboard_rpc.sql's own fy_window CTE and by
-- src/functions/fiscalYearPresets.js: a date on or after April belongs to the
-- FY starting that calendar year; January-March belongs to the FY that started
-- the previous one. Computed ONCE here rather than repeated per CTE.
fy_window as (
    select (extract(year from current_date)
            - case when extract(month from current_date) >= 4 then 0 else 1 end)::int
             as fy_start_year
),

fy_bounds as (
    select fw.fy_start_year,
           make_date(fw.fy_start_year, 4, 1)                                as fy_start,
           make_date(fw.fy_start_year + 1, 3, 1)                            as fy_end_month,
           make_date(fw.fy_start_year - 1, 4, 1)                            as prior_fy_start,
           make_date(fw.fy_start_year, 3, 1)                                as prior_fy_end_month,
           -- "2026-2027", matching FISCAL_YEAR_PRESETS' own label format so the
           -- tile reads identically to the page's FiscalYearFilterBar options.
           fw.fy_start_year::text || '-' || (fw.fy_start_year + 1)::text    as fy_label
    from fy_window fw
),

-- Day arithmetic for the current, part-invoiced month.
cal as (
    select date_trunc('month', current_date)::date            as cur_month,
           extract(day from current_date)::numeric            as day_elapsed,
           extract(day from (date_trunc('month', current_date)
                             + interval '1 month - 1 day'))::numeric
                                                              as days_in_month
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

proj as (
    select * from public.v_sales_projection_ensemble
),

nxt as (
    select * from proj where horizon = 1
),

-- ─── fiscal-year build-up ──────────────────────────────────────────────────
-- Three parts, kept separate so the tile can show its own arithmetic and a
-- reader can check it:
--     closed actuals  +  current month estimate  +  projected remainder
fy_actual as (
    select coalesce(sum(i.value), 0) as v
    from inv i
    cross join fy_bounds b
    where i.is_complete
      and i.period_month >= b.fy_start
      and i.period_month <= b.fy_end_month
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
-- So: take what is banked, and add the model's monthly level for the days left.
-- Standard practice, and it uses only a horizon that was actually scored.
cur_est as (
    select cm.v
             + n.projected * ((c.days_in_month - c.day_elapsed) / c.days_in_month)
               as v,
           ((c.days_in_month - c.day_elapsed) / c.days_in_month) as frac_remaining
    from cur_mtd cm
    cross join cal c
    cross join nxt n
),

fy_proj as (
    select coalesce(sum(p.projected), 0)                        as v,
           count(*)::int                                        as n_months,
           count(*) filter (where p.horizon > h.cap)::int        as n_beyond,
           coalesce(sum(p.total_var), 0)                        as var_sum
    from proj p
    cross join fy_bounds b
    cross join cal c
    cross join hcap h
    where p.period_month >  c.cur_month
      and p.period_month <= b.fy_end_month
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
      and eb.cl_weight_label = 'smooth w(h)'
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
           -- cannot reach this span length; `bandBasis` reports which was used.
           coalesce(se.rmse_total, sqrt(nullif(fp.var_sum, 0)))  as span_sd,
           se.origins                                    as span_origins_used,
           -- The part-month carries the same uncertainty as a full month,
           -- scaled by how much of it is still unknown.
           n.total_var * power(ce.frac_remaining, 2)      as cur_month_var
    from fy_bounds b
    cross join fy_actual fa
    cross join cur_est ce
    cross join fy_proj fp
    cross join nxt n
    left join span_err se on true
),

fy_band as (
    select ft.*,
           ft.span_sd * ft.span_sd + ft.cur_month_var as fy_var
    from fy_total ft
),

-- Lognormal, the same transform the ensemble itself uses. Right-skewed: the
-- downside is bounded by committed orders, the upside is a fat tail because
-- one large tender can land.
fy_interval as (
    select fb.*,
           case when fb.outlook > 0 and fb.fy_var > 0
                then ln(1 + fb.fy_var / power(fb.outlook, 2)) end as sigma_sq
    from fy_band fb
),

fy_final as (
    select fi.*,
           case when fi.sigma_sq is not null
                then exp(ln(fi.outlook) - fi.sigma_sq / 2 - sqrt(fi.sigma_sq) * 1.2816)
           end as fy_lo_80,
           case when fi.sigma_sq is not null
                then exp(ln(fi.outlook) - fi.sigma_sq / 2 + sqrt(fi.sigma_sq) * 1.2816)
           end as fy_hi_80
    from fy_interval fi
),

prior_fy_actual as (
    select coalesce(sum(i.value), 0) as v
    from inv i
    cross join fy_bounds b
    where i.is_complete
      and i.period_month >= b.prior_fy_start
      and i.period_month <= b.prior_fy_end_month
),

-- ─── comparators ───────────────────────────────────────────────────────────
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

-- Same six months, year on year -- the comparison behind §11g Finding 5.
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

-- ─── model agreement, for the Confidence tile ──────────────────────────────
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
-- The three caches in `private` are refreshed by hand (Phase E schedules it).
-- If a month closes and nobody runs refresh_sales_projection_caches(), every
-- number on this dashboard silently describes last month's world.
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

-- ─── chart data ────────────────────────────────────────────────────────────
-- 24 months of history. The LAST historical row also carries `projected` and a
-- degenerate band equal to the actual, so the dashed forward line and the
-- shaded band both begin exactly at the origin instead of floating detached a
-- month to the right.
-- ── WHAT THE MODEL WOULD HAVE SAID, MONTH BY MONTH ─────────────────────────
--
-- The one-month-ahead ensemble prediction for each PAST month, so the dashed
-- line runs across history beside the solid actual and the chart answers "has
-- this thing been any good?" without anyone having to open a document.
--
-- This is legitimate, not a victory lap. v_sales_projection_ensemble_backtest
-- rebuilds the blend at each historical origin with POINT-IN-TIME calibration
-- and weights -- only months whose target fell strictly before that origin --
-- so no row here was fitted on the month it is predicting.
--
-- ONE HONEST CAVEAT, carried into the subtitle and §11g: the calibration window
-- (12 months) and the order-book weight rule were chosen by scoring the whole
-- backtest. That is ordinary hyper-parameter selection, but it does mean this
-- historical fit is mildly optimistic against what live forecasting will
-- deliver. Phase E's frozen snapshots are the honest experience study; this is
-- the best available until three months of them exist.
backfit as (
    select eb.target_month,
           eb.predicted
    from private.mv_sales_projection_ensemble_backtest eb
    where eb.estimator       = 'ensemble'
      and eb.window_months   = 12
      and eb.cl_weight_label = 'smooth w(h)'
      and eb.horizon         = 1
),

fan_hist as (
    select i.period_month,
           to_char(i.period_month, 'Mon YYYY')  as name,
           i.value                              as actual,
           bf.predicted                         as backfit,
           (i.period_month = (select max(i2.period_month) from inv i2 where i2.is_complete))
                                                as is_anchor
    from inv i
    cross join cal c
    left join backfit bf on bf.target_month = i.period_month
    where i.is_complete
      and i.period_month > (c.cur_month - interval '25 months')::date
),

-- The band around a historical prediction, from the SAME measured h=1 variance
-- the forward h=1 band uses. Without it the dashed line would show the misses
-- but not whether they were inside the range we published -- which is the
-- actual question. Lognormal, matching the ensemble's own transform.
fan_hist_band as (
    select fh.*,
           case when fh.backfit > 0 and n.total_var > 0
                then ln(1 + n.total_var / power(fh.backfit, 2)) end as sigma_sq
    from fan_hist fh
    cross join nxt n
),

-- ── THE CURRENT MONTH -- otherwise a hole in the middle of the chart ───────
--
-- fan_hist takes only CLOSED months and fan_fwd starts at h=1, which is NEXT
-- month. The month we are actually in belonged to neither, so the line broke
-- between the last closed month and the first projected one -- while the
-- Full-Year Outlook tile was quietly counting that same month all along.
--
-- It is shown as PROJECTED, not actual: it carries the same month-to-date
-- plus run-rate estimate the tile uses. Plotting the raw month-to-date figure
-- as an actual would draw a collapse that is not real -- on the 3rd of the
-- month that is three days of invoicing against a full month everywhere else.
--
-- Its band is narrower than a full month's by construction: part of the month
-- is already banked, so only the remaining fraction is uncertain.
fan_cur as (
    select c.cur_month                          as period_month,
           to_char(c.cur_month, 'Mon YYYY')     as name,
           ce.v                                 as estimate,
           n.total_var * power(ce.frac_remaining, 2) as cur_var
    from cal c
    cross join cur_est ce
    cross join nxt n
),

fan_cur_band as (
    select fc.*,
           case when fc.estimate > 0 and fc.cur_var > 0
                then ln(1 + fc.cur_var / power(fc.estimate, 2)) end as sigma_sq
    from fan_cur fc
),

fan_fwd as (
    select p.period_month,
           to_char(p.period_month, 'Mon YYYY')  as name,
           p.projected, p.lo_80, p.hi_80, p.lo_95, p.hi_95
    from proj p
    cross join hcap h
    where p.horizon <= h.cap
),

fan as (
    select fh.period_month,
           fh.name,
           round(fh.actual)                                        as actual,
           -- The dashed line now runs across history too. Falls back to the
           -- actual on the final month only if the backtest cannot reach it
           -- (stale caches), so the line still meets the forward projection
           -- instead of breaking at the seam.
           coalesce(round(fh.backfit),
                    case when fh.is_anchor then round(fh.actual) end)
                                                                   as projected,
           case when fh.sigma_sq is not null
                then json_build_array(
                       round(exp(ln(fh.backfit) - fh.sigma_sq / 2 - sqrt(fh.sigma_sq) * 1.2816)),
                       round(exp(ln(fh.backfit) - fh.sigma_sq / 2 + sqrt(fh.sigma_sq) * 1.2816)))
                when fh.is_anchor
                then json_build_array(round(fh.actual), round(fh.actual))
           end                                                     as band80,
           case when fh.sigma_sq is not null
                then json_build_array(
                       round(exp(ln(fh.backfit) - fh.sigma_sq / 2 - sqrt(fh.sigma_sq) * 1.9600)),
                       round(exp(ln(fh.backfit) - fh.sigma_sq / 2 + sqrt(fh.sigma_sq) * 1.9600)))
                when fh.is_anchor
                then json_build_array(round(fh.actual), round(fh.actual))
           end                                                     as band95
    from fan_hist_band fh

    union all

    select fc.period_month,
           fc.name,
           null::numeric,
           round(fc.estimate),
           case when fc.sigma_sq is not null
                then json_build_array(
                       round(exp(ln(fc.estimate) - fc.sigma_sq / 2 - sqrt(fc.sigma_sq) * 1.2816)),
                       round(exp(ln(fc.estimate) - fc.sigma_sq / 2 + sqrt(fc.sigma_sq) * 1.2816)))
           end,
           case when fc.sigma_sq is not null
                then json_build_array(
                       round(exp(ln(fc.estimate) - fc.sigma_sq / 2 - sqrt(fc.sigma_sq) * 1.9600)),
                       round(exp(ln(fc.estimate) - fc.sigma_sq / 2 + sqrt(fc.sigma_sq) * 1.9600)))
           end
    from fan_cur_band fc

    union all

    select ff.period_month,
           ff.name,
           null::numeric,
           round(ff.projected),
           json_build_array(round(ff.lo_80), round(ff.hi_80)),
           json_build_array(round(ff.lo_95), round(ff.hi_95))
    from fan_fwd ff
),

-- Every model's full-month estimate for next month, plus the blend. The
-- actuarial exhibit: it makes the number challengeable instead of merely
-- believable.
method_exhibit as (
    select 'Order Book (chain-ladder)'::text as name,
           round(n.implied_from_order_book)  as value,
           false                             as is_blend,
           1                                 as sort_order
    from nxt n

    union all

    select case m->>'model'
             when 'baseline' then 'Trailing Mean (ma12)'
             when 'freqsev'  then 'Frequency x Severity'
             when 'ses'      then 'Exponential Smoothing'
             else m->>'model'
           end,
           round((m->>'implied')::numeric),
           false,
           2
    from nxt n, jsonb_array_elements(n.model_detail->'apriori') m

    union all

    select 'Blend (published)', round(n.projected), true, 3
    from nxt n
),

-- How the published number is built: the order book's share plus the
-- statistical share. The two sum exactly to the blend by construction.
build_up as (
    select 'From Order Book'::text as name,
           round(n.order_book_weight * n.implied_from_order_book) as value,
           1 as sort_order
    from nxt n
    union all
    select 'From Statistical Models',
           round((1 - n.order_book_weight) * n.implied_from_apriori),
           2
    from nxt n
    union all
    select 'Projected Total', round(n.projected), 3
    from nxt n
)

select json_build_object(

    'kpis', (
        select json_build_object(
            -- ─── TILE 1: Full-Year Outlook (fiscal, leads the section) ─────
            'fiscalYearLabel',                f.fy_label,
            'fullYearOutlook',                round(f.outlook),
            'fullYearActualToDate',           round(f.actual_to_date),
            'fullYearCurrentMonthEstimate',   round(f.current_month_est),
            'fullYearProjectedRemainder',     round(f.projected_remainder),
            'fullYearLo80',                   round(f.fy_lo_80),
            'fullYearHi80',                   round(f.fy_hi_80),
            'fullYearMonthsProjected',        f.n_months,
            'fullYearMonthsBeyondValidated',  f.n_beyond,
            'fullYearPriorActual',            round(pfy.v),
            'fullYearVsPriorPct',             case when pfy.v > 0
                                                   then round(100.0 * f.outlook / pfy.v - 100, 1) end,

            -- ─── TILE 2: Next Month ────────────────────────────────────────
            'nextMonthLabel',                 to_char(n.period_month, 'Mon YYYY'),
            'nextMonthProjected',             round(n.projected),
            'nextMonthLo80',                  round(n.lo_80),
            'nextMonthHi80',                  round(n.hi_80),
            'nextMonthOrderBookWeightPct',    round(100.0 * n.order_book_weight, 0),
            'nextMonthVsTrailing3mPct',       case when ti.avg_3m > 0
                                                   then round(100.0 * n.projected / ti.avg_3m - 100, 0) end,
            'nextMonthVsLastYearPct',         case when lysm.v > 0
                                                   then round(100.0 * n.projected / lysm.v - 100, 0) end,

            -- ─── TILE 3: Order Book vs Statistical ─────────────────────────
            'orderBookImplied',               round(n.implied_from_order_book),
            'aprioriImplied',                 round(n.implied_from_apriori),
            'orderBookGap',                   round(n.implied_from_order_book - n.implied_from_apriori),
            'orderBookGapPct',                case when n.implied_from_apriori > 0
                                                   then round(100.0 * n.implied_from_order_book
                                                              / n.implied_from_apriori - 100, 0) end,
            'ordersTrailing3mAvg',            round(tor.avg_3m),
            'invoicedTrailing3mAvg',          round(ti.avg_3m),
            'ordersYoyPct',                   case when y.ord_prior > 0
                                                   then round(100.0 * y.ord_recent / y.ord_prior - 100, 0) end,
            'invoicedYoyPct',                 case when y.inv_prior > 0
                                                   then round(100.0 * y.inv_recent / y.inv_prior - 100, 0) end,

            -- ─── TILE 4: Forecast Confidence (the one verdict tile) ────────
            'modelSpreadPct',                 case when a.projected > 0
                                                   then round(100.0 * (a.high_v - a.low_v) / a.projected, 0) end,
            'modelHighImplied',               round(a.high_v),
            'modelLowImplied',                round(a.low_v),
            -- ::numeric is load-bearing. within_var/between_var come from
            -- exp()/avg() arithmetic and are double precision, and Postgres
            -- has no round(double precision, int) -- only round(numeric, int).
            -- Every other percentage here is already numeric.
            'betweenModelSharePct',           case when (n.within_var + n.between_var) > 0
                                                   then round((100.0 * n.between_var
                                                              / (n.within_var + n.between_var))::numeric, 0) end,

            -- ─── provenance and health ─────────────────────────────────────
            -- Surfaced as plain keys so the frontend can explain itself rather
            -- than render a confident-looking wrong number. Same convention as
            -- get_sales_reports_dashboard's ownerSapMappingMissing.
            'publishedHorizonCap',            h.cap,
            'bandOriginsAtH1',                n.band_origins,
            'spanOriginsUsed',                f.span_origins_used,
            'bandBasis',                      case when f.span_origins_used is not null
                                                   then 'measured span error'
                                                   else 'summed monthly variance' end,
            'currentMonthEstimateBasis',      'month-to-date actual + model level pro-rated over days remaining',
            'cacheLatestMonth',               cs.cache_latest,
            'seriesLatestCompleteMonth',      cs.series_latest,
            'cacheStale',                     (cs.cache_latest is distinct from cs.series_latest),
            'sourceView',                     'v_sales_projection_ensemble'
        )
        from fy_final f
        cross join nxt n
        cross join hcap h
        cross join prior_fy_actual pfy
        cross join trailing_inv ti
        cross join trailing_ord tor
        cross join yoy y
        cross join last_year_same_month lysm
        cross join agreement a
        cross join cache_state cs
    ),

    'fanChartData', (
        select coalesce(json_agg(
                   json_build_object(
                       'name',      x.name,
                       'actual',    x.actual,
                       'projected', x.projected,
                       'band80',    x.band80,
                       'band95',    x.band95
                   ) order by x.period_month
               ), '[]'::json)
        from fan x
    ),

    'methodExhibitData', (
        select coalesce(json_agg(
                   json_build_object('name', x.name, 'value', x.value, 'isBlend', x.is_blend)
                   order by x.sort_order, x.value desc
               ), '[]'::json)
        from method_exhibit x
    ),

    'buildUpData', (
        select coalesce(json_agg(
                   json_build_object('name', x.name, 'value', x.value)
                   order by x.sort_order
               ), '[]'::json)
        from build_up x
    )

) into result;

return result;

end;
$$;


-- ############################################################################
-- VERIFY
--
--     select get_sales_projections();
--
-- Check, in this order:
--   1. kpis.nextMonthProjected equals verification C6's h=1 figure exactly.
--   2. fullYearActualToDate + fullYearCurrentMonthEstimate
--        + fullYearProjectedRemainder = fullYearOutlook. The three parts are
--      published separately precisely so this is checkable by eye.
--   3. No array key returns null. All three use coalesce(..., '[]'::json).
--   4. cacheStale is false. If true, run:
--        select public.refresh_sales_projection_caches();
--   5. bandBasis reads 'measured span error'. 'summed monthly variance' means
--      the backtest could not reach this span length and the band assumes
--      independent months, which C16 showed they are not.
-- ############################################################################
