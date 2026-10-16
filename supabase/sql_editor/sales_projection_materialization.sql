-- ############################################################################
-- Projection backtest caches -- private.mv_sales_projection_baseline
--                              private.mv_sales_chainladder_backtest
--
-- Phase C/D of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
--
-- ── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────
--
-- ONE query against v_sales_projection_ensemble recomputes:
--
--     v_sales_projection_baseline      x4   via v_sales_model_ses,
--                                           via v_sales_projection_backtest
--                                             -> v_sales_model_baseline,
--                                           via v_sales_projection_calibration,
--                                           and directly
--     v_sales_chainladder_backtest     x2   via v_sales_projection_calibration,
--                                           via v_sales_model_chainladder
--
-- Six full backtest rebuilds to produce twelve rows. The scoring view scores
-- twelve methods at twelve horizons across ~100 origins; the chain-ladder
-- backtest reconstructs the entire order book at every origin. Verification
-- C22b times out on it outright.
--
-- The dashboard RPC will call that same view on every page load. No tile can
-- afford this, so the fix is a Phase D prerequisite rather than a tuning
-- exercise.
--
-- ── WHY MATERIALISING IS CORRECT, NOT A SHORTCUT ────────────────────────────
--
-- Both objects are backtests over CLOSED history. Their output cannot change
-- until either a new month closes or a model is edited. Recomputing them per
-- query is not an optimisation problem -- it is the wrong shape for the data.
--
-- The views remain the DEFINITION and are not deleted. These are the answer.
--
-- ── WHY THE `private` SCHEMA ────────────────────────────────────────────────
--
-- A materialized view cannot carry RLS. `private` is not in PostgREST's
-- exposed schemas, so nothing here is reachable through the API directly,
-- while security-invoker views and RPCs can still read it.
--
-- This mirrors private.mv_gl_monthly_account_summary and
-- private.mv_gl_monthly_balance_sheet_snapshot in hyrax-data-platform, and the
-- same consequence applies: access control happens in the RPC body, not on the
-- object. get_sales_reports_dashboard_rpc.sql already carries that guard, and
-- get_finance_dashboard_rpc.sql carries it for exactly this reason -- see its
-- note, "its GL source is a materialized view, which can't have RLS at all".
--
-- ── REFRESH ─────────────────────────────────────────────────────────────────
--
-- Two events invalidate these, and nothing else:
--
--   1. A new month closes -- the pipeline lands a complete month, adding
--      origins at every horizon.
--   2. Any model, calibration rule, weight rule or horizon set is edited.
--
--     select public.refresh_sales_projection_caches();
--
-- Phase E schedules that monthly alongside the snapshot job. It must NOT run
-- more often "just in case": a projection whose history quietly shifts between
-- being read and being acted on is worse than one that is a day stale.
--
-- ⚠ RESTATED 2026-10-15, because section 6 looked like it broke this rule.
--
-- The rule was never "refresh rarely". It is: DO NOT REFRESH A CACHE FASTER
-- THAN ITS INPUTS CHANGE. The two events above are the complete list of what
-- invalidates caches 0-3, because their contents are a pure function of
-- CLOSED months -- so monthly is the correct cadence for them, and refreshing
-- them nightly would churn scored history for no gain.
--
-- That enumeration is FALSE for section 6's cache. v_sales_projection_ensemble
-- reads the open order book through v_sales_model_chainladder, and
-- v_sales_orderbook_open carries no date filter at all -- it moves every time
-- an order is keyed or an invoice raised. A third invalidating event exists
-- for that cache and only that cache:
--
--   3. The order book moves -- which is daily.
--
-- So section 6 refreshes daily. That is the same rule applied, not an
-- exception carved out of it. See section 6's own banner.
--
-- ── ORDER ───────────────────────────────────────────────────────────────────
--
-- Run AFTER sales_projection_baseline_view.sql and
-- sales_chainladder_backtest_view.sql exist, and BEFORE re-running the six
-- views that now read these caches:
--
--     sales_projection_backtest_view.sql
--     sales_model_baseline_view.sql
--     sales_model_ses_view.sql
--     sales_model_chainladder_view.sql
--     sales_projection_calibration_view.sql
--     sales_projection_ensemble_view.sql
--     sales_projection_ensemble_backtest_view.sql
--
-- ⚠ NOT IDEMPOTENT ONCE THE CONSUMERS POINT HERE -- BY DESIGN ⚠
--
-- PostgreSQL has no `create or replace materialized view`, so this file drops
-- and recreates. The drops are deliberately WITHOUT `cascade`: once the six
-- views above read these caches, a cascading drop would silently delete all
-- six, which is the exact failure that cost a full rebuild on 2026-10-03.
--
-- So on a re-run this file FAILS with
--     2BP01: cannot drop ... because other objects depend on it
-- and that is the correct outcome. It is telling you that you want
--
--     select public.refresh_sales_projection_caches();
--
-- which is almost always what you actually need. Re-run this file only when
-- the cached COLUMNS change -- and then re-run all six consumers after it.
-- ############################################################################

-- ############################################################################
-- ⚠ PARTIAL RE-RUN -- READ THIS IF SECTIONS 1 AND 2 ARE ALREADY DEPLOYED ⚠
--
-- Once the consumer views point at these caches, the drops in sections 1 and 2
-- FAIL with `2BP01: cannot drop ... because other objects depend on it`. That
-- is deliberate (see the note further down) and it is not an error to work
-- around -- it is the file refusing to delete six views behind your back.
--
-- ⚠ 2026-10-14: section 0 is NEW and sections 1-3 are unchanged. On an estate
-- that already has 1-3, run ONLY section 0, its grant, and section 5. Then
-- re-run sales_order_development_view.sql, which now reads the new cache.
--
-- To add section 3 to an estate that already has 1 and 2, run ONLY:
--
--     * section 3 in full (drop + create + index)
--     * the one new grant in section 4
--         grant select on private.mv_sales_projection_ensemble_backtest
--             to anon, authenticated, service_role;
--     * section 5 in full -- it is `create or replace function`, always safe
--
-- Then re-run sales_projection_ensemble_view.sql, which now reads the new
-- cache for its interval width.
--
-- Sections 1 and 2 are unchanged and must NOT be re-run.
--
-- ⚠ 2026-10-15: section 6 is NEW and sections 0-3 are unchanged. On an estate
-- that already has 0-3, run ONLY section 6, its grant, and section 5. Nothing
-- needs re-running afterwards -- the consumers are RPCs, repointed separately.
--
-- ⚠⚠ SECTION 6 DOES NOT HAVE THE 2BP01 PROTECTION THE REST OF THIS FILE RELIES
-- ON. Read the next paragraph before re-running anything.
--
-- The whole safety story above -- "a re-run FAILS with 2BP01 and that is the
-- correct outcome" -- works because sections 0-3 are read by VIEWS, and a view
-- registers a catalog dependency that a no-cascade drop refuses to break.
--
-- Section 6's cache is read by two FUNCTION BODIES
-- (get_sales_projections, snapshot_sales_projections). plpgsql bodies
-- register NO catalog dependency.
-- So `drop materialized view if exists private.mv_sales_projection_ensemble`
-- SUCCEEDS SILENTLY, and the next page load raises 42P01 instead.
--
-- Re-running section 6 is therefore safe only if you immediately re-create it
-- in the same session -- which the section does, in the very next statement.
-- Do not run the drop on its own, and do not assume this file will stop you.
-- ############################################################################

create schema if not exists private;


-- ── 0. the point-in-time development rates ─────────────────────────────────
--
-- Added 2026-10-14. Carries the chain-ladder conversion rates for EVERY as-of
-- month, so the backtest can score a past month using only what was knowable
-- then. Before this, it scored March 2025 against rates partly derived from
-- 2026 -- the model was being shown the answer.
--
-- FIRST in this file and FIRST in the refresh, because everything else reads
-- it: v_sales_order_development is now a filter over it at the current month,
-- and v_sales_chainladder_backtest joins it by origin.
drop materialized view if exists private.mv_sales_order_development_pit;

create materialized view private.mv_sales_order_development_pit as
select * from public.v_sales_order_development_pit;

-- v_sales_order_development filters to one as-of month; the backtest joins on
-- (as_of_month, age_months) for every origin. Both are covered.
create index if not exists mv_sales_order_dev_pit_lookup
    on private.mv_sales_order_development_pit (as_of_month, age_months);


-- ── 1. the scoring harness ──────────────────────────────────────────────────
drop materialized view if exists private.mv_sales_projection_baseline;

create materialized view private.mv_sales_projection_baseline as
select * from public.v_sales_projection_baseline;

-- Every consumer filters on measure + method and joins on horizon; the
-- calibration and ensemble views additionally range-scan period_month for
-- their recent-window cutoff.
create index if not exists mv_sales_proj_baseline_lookup
    on private.mv_sales_projection_baseline (measure, method, horizon, period_month);

create index if not exists mv_sales_proj_baseline_horizon
    on private.mv_sales_projection_baseline (horizon, period_month);


-- ── 2. the chain-ladder backtest ────────────────────────────────────────────
drop materialized view if exists private.mv_sales_chainladder_backtest;

create materialized view private.mv_sales_chainladder_backtest as
select * from public.v_sales_chainladder_backtest;

-- v_sales_model_chainladder groups by horizon; the calibration view filters
-- origin_month against its window; the ensemble backtest's point-in-time
-- lateral range-scans target_month within horizon.
create index if not exists mv_sales_cl_backtest_horizon
    on private.mv_sales_chainladder_backtest (horizon, origin_month);

create index if not exists mv_sales_cl_backtest_target
    on private.mv_sales_chainladder_backtest (horizon, target_month);


-- ── 3. the ensemble backtest ────────────────────────────────────────────────
--
-- Added 2026-10-03 for a reason beyond speed: v_sales_projection_ensemble now
-- takes its INTERVAL WIDTH from measured error, and this is where that is
-- measured. C22/C23 found the composed variance (within + between) 46-134%
-- too wide across h=1..6, and wrong in a horizon-DEPENDENT way -- the
-- chain-ladder's variance is divided by coverage(h)^2, which grows explosively
-- as coverage collapses, while measured error does not grow at all.
--
-- Scaling that by a factor would have been fitting a correction to an
-- artefact. Replacing it with measured error removes the artefact.
--
-- This also supersedes sales_projection_backtest_cache.sql, which created the
-- same object in `public`. If that file was ever run, clean it up with:
--     drop materialized view if exists public.mv_sales_projection_ensemble_backtest;
drop materialized view if exists private.mv_sales_projection_ensemble_backtest;

create materialized view private.mv_sales_projection_ensemble_backtest as
select * from public.v_sales_projection_ensemble_backtest;

-- The ensemble view filters to one estimator/window/weight and groups by
-- horizon; the diagnostics do the same with other combinations.
create index if not exists mv_sales_ens_backtest_lookup
    on private.mv_sales_projection_ensemble_backtest
       (estimator, window_months, cl_weight_label, horizon);


-- ── 4. grants ───────────────────────────────────────────────────────────────
-- Mirrors private_schema_grants_migration.sql in hyrax-data-platform. `private`
-- is not a PostgREST-exposed schema, so this grants readability to
-- security-invoker views WITHOUT making the objects reachable through the API.
grant usage on schema private to anon, authenticated, service_role;

grant select on private.mv_sales_order_development_pit
    to anon, authenticated, service_role;
grant select on private.mv_sales_projection_baseline
    to anon, authenticated, service_role;
grant select on private.mv_sales_chainladder_backtest
    to anon, authenticated, service_role;
grant select on private.mv_sales_projection_ensemble_backtest
    to anon, authenticated, service_role;

-- Section 6's cache is granted in SECTION 6, not here -- its object does not
-- exist yet at this point in the file, and a grant on a missing relation
-- raises 42P01 rather than being skipped.


-- ── 5. refresh ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER because `refresh materialized view` requires ownership, and
-- the callers (a pg_cron job in Phase E, or a developer after editing a model)
-- are not the owner. search_path is pinned -- a SECURITY DEFINER function with
-- a mutable search_path is a privilege-escalation vector.
--
-- ORDER IS LOAD-BEARING, in both directions.
--
-- The development rates go FIRST: the chain-ladder backtest joins them by
-- origin, so refreshing it against last month's rates would silently score
-- every origin with the wrong numbers.
--
-- The ensemble backtest goes LAST: it reads both other caches through
-- v_sales_projection_ensemble_backtest. Refreshing it first would not error --
-- it would quietly produce a stale interval width, which is the worst kind of
-- wrong.
--
-- ⚠ FORWARD REFERENCE (2026-10-15): the body below calls
-- public.refresh_sales_projection_ensemble_cache(), which is defined in
-- SECTION 6, further down this file. That is fine on a full-file run --
-- plpgsql bodies are syntax-checked at creation but their function calls
-- resolve at CALL time, by which point section 6 has run. On a partial re-run,
-- run BOTH sections or this function raises 42883 at runtime.
create or replace function public.refresh_sales_projection_caches()
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
    v_started  timestamptz := clock_timestamp();
    v_ensemble text;
begin
    refresh materialized view private.mv_sales_order_development_pit;
    refresh materialized view private.mv_sales_chainladder_backtest;
    refresh materialized view private.mv_sales_projection_baseline;
    refresh materialized view private.mv_sales_projection_ensemble_backtest;

    -- The published blend goes after all four, because it reads every one of
    -- them transitively. CALLS the sibling function rather than repeating its
    -- `refresh` statement, so the `concurrently` decision lives in exactly one
    -- place -- two copies of one rule drifting apart is how the
    -- `cl_weight_label = 'smooth w(h)'` filter survived a weight change in
    -- three files at once.
    v_ensemble := public.refresh_sales_projection_ensemble_cache();

    return format(
        'refreshed in %s -- development rates %s rows, baseline %s rows, '
        'chainladder backtest %s rows, ensemble backtest %s rows; %s',
        clock_timestamp() - v_started,
        (select count(*) from private.mv_sales_order_development_pit),
        (select count(*) from private.mv_sales_projection_baseline),
        (select count(*) from private.mv_sales_chainladder_backtest),
        (select count(*) from private.mv_sales_projection_ensemble_backtest),
        v_ensemble
    );
end;
$$;

revoke all on function public.refresh_sales_projection_caches() from public;
grant execute on function public.refresh_sales_projection_caches()
    to authenticated, service_role;


-- ############################################################################
-- 6. THE PUBLISHED BLEND (added 2026-10-15)
--
-- v_sales_projection_ensemble measured 4,202 ms to produce TWELVE ROWS. It
-- joins six live model views and scans the ensemble backtest cache twice, and
-- it ran on every page load -- twice over, because two RPCs read it. For
-- comparison, v_sales_projection_accuracy beside it measures 39 ms.
--
-- ── THIS CACHE IS NOT LIKE THE FOUR ABOVE. THREE DIFFERENCES. ───────────────
--
-- (a) ⚠ IT FREEZES THE CALENDAR, AND THAT IS THE WHOLE RISK.
--
--     The ensemble stores no dates. Every row's period_month is DERIVED at
--     query time, in three model views:
--
--         (date_trunc('month', current_date) + (horizon||' months')::interval)
--
--     A live view can never be wrong about which month horizon=1 is. A cache
--     can, and will be, on the 1st of every month until the refresh fires.
--
--     It fails SILENTLY, not loudly. get_sales_projections_rpc.sql filters
--     `where p.period_month > c.cur_month` against a LIVE calendar, so a stale
--     h=1 row is simply dropped: n_months falls by one, that feeds
--     span_origins' `eb.horizon <= fp.n_months`, and the Full-Year outlook AND
--     its band both move. Nothing raises.
--
--     It cannot be defended downstream either. Guarding the forward branch
--     with `period_month > cur_month` would empty `nxt`, and
--     get_sales_projections does `cross join nxt` in six places -- an empty
--     nxt nulls the entire kpis object, which the frontend renders as a crash
--     rather than a banner.
--
--     So the daily refresh is a CORRECTNESS REQUIREMENT, not a tuning choice,
--     and its slot is load-bearing: 00:20 MYT turns a nine-hour wrong-month
--     window on the 1st of each month into twenty minutes. See
--     schedule_refresh_sales_projection_ensemble_cron.sql.
--
-- (b) cache_refreshed_at BREAKS THE UNIFORM `select * from public.<view>`
--     SHAPE of sections 0-3, deliberately.
--
--     This estate prefers "detect staleness from the data, not a timestamp
--     table", and for caches 0-3 that works -- their max(period_month) of
--     scored history IS a self-describing watermark. These twelve FORWARD rows
--     carry no such marker: period_month encodes only the MONTH a refresh ran
--     in. A cron that dies on the 3rd and stays dead three weeks would be
--     completely undetectable. The convention's premise fails here, so the
--     convention does not apply here.
--
-- (c) A UNIQUE INDEX AND `refresh ... concurrently` -- BOTH ESTATE FIRSTS.
--
--     horizon is unique by construction: every contributing CTE groups by it.
--     A plain index on a 12-row relation would never be chosen by the planner,
--     so it is only worth having as the UNIQUE one -- which doubles as a
--     structural assertion and is what `concurrently` requires.
--
--     `concurrently` matters more than twelve rows suggests. REFRESH re-runs
--     the WHOLE 4.2-second defining query holding ACCESS EXCLUSIVE; twelve
--     rows is the OUTPUT size, not the refresh cost. Without it every reader
--     blocks for 4.2s -- including during the monthly 09:00 job, when people
--     are working.
--
--     If `concurrently` ever raises inside plpgsql, drop the keyword from the
--     function below and redeploy; everything else here is unaffected.
--
-- ── ⚠ NO 2BP01 PROTECTION HERE, UNLIKE SECTIONS 0-3 ────────────────────────
--
-- This file's whole safety story is that a no-cascade drop FAILS once views
-- depend on a cache. That works because views register a catalog dependency.
--
-- This cache's consumers are two FUNCTION BODIES -- get_sales_projections
-- and snapshot_sales_projections -- and plpgsql bodies register NONE. The drop below SUCCEEDS SILENTLY and the next page
-- load raises 42P01. Re-run this section only as a whole, never the drop on
-- its own, and do not expect the file to stop you.
--
-- ── ONE MORE TRAP, UPSTREAM ────────────────────────────────────────────────
--
-- sales_projection_ensemble_view.sql says to use `drop view ... cascade` when
-- its column list changes. That drop now silently takes this cache with it --
-- the 2026-10-03 cascade failure, one level up. A column-list change there
-- means: drop view cascade -> re-run this section -> re-grant -> refresh.
-- ############################################################################

drop materialized view if exists private.mv_sales_projection_ensemble;

create materialized view private.mv_sales_projection_ensemble as
select v.*,
       -- Re-evaluated on every refresh, because REFRESH re-runs this query.
       -- The only thing in these twelve rows that records WHEN they were built.
       clock_timestamp() as cache_refreshed_at
from public.v_sales_projection_ensemble v;

-- UNIQUE, not a lookup path. See (c) above.
create unique index if not exists mv_sales_projection_ensemble_horizon
    on private.mv_sales_projection_ensemble (horizon);

-- Granted here rather than in section 4, because section 4 runs before this
-- object exists. `anon` is included for consistency with the other four, not
-- because anything needs it -- both RPCs that read this cache raise 42501
-- before reaching it when auth.uid() is null.
grant select on private.mv_sales_projection_ensemble
    to anon, authenticated, service_role;


-- Separate from refresh_sales_projection_caches() because the cadences differ:
-- caches 0-3 are invalidated by a month closing (monthly), this one also by the
-- order book moving (daily). refresh_sales_projection_caches() CALLS this, so
-- the monthly job still rebuilds everything in the right order.
create or replace function public.refresh_sales_projection_ensemble_cache()
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
    v_started timestamptz := clock_timestamp();
    v_rows    bigint;
    v_h1      date;
begin
    refresh materialized view concurrently private.mv_sales_projection_ensemble;

    select count(*), max(period_month) filter (where horizon = 1)
      into v_rows, v_h1
      from private.mv_sales_projection_ensemble;

    return format(
        'ensemble cache refreshed in %s -- %s rows, h=1 is %s',
        clock_timestamp() - v_started, v_rows, v_h1
    );
end;
$$;

revoke all on function public.refresh_sales_projection_ensemble_cache() from public;
grant execute on function public.refresh_sales_projection_ensemble_cache()
    to authenticated, service_role;


comment on materialized view private.mv_sales_projection_baseline is
    'Frozen copy of v_sales_projection_baseline. The view scores 12 methods x '
    '12 horizons over ~100 origins and was being recomputed FOUR times by a '
    'single v_sales_projection_ensemble query. Backtest over closed history -- '
    'cannot change until a month closes or a model is edited. Refresh with '
    'public.refresh_sales_projection_caches().';

comment on materialized view private.mv_sales_chainladder_backtest is
    'Frozen copy of v_sales_chainladder_backtest, which reconstructs the order '
    'book at every historical origin. Was being recomputed TWICE per '
    'v_sales_projection_ensemble query. Refresh with '
    'public.refresh_sales_projection_caches().';

comment on materialized view private.mv_sales_projection_ensemble is
    'Frozen copy of v_sales_projection_ensemble -- the published blend. The '
    'view measured 4,202 ms to produce twelve rows and ran on every page load. '
    'UNLIKE THE OTHER CACHES THIS ONE FREEZES THE CALENDAR: period_month is '
    'derived from current_date, so a cache built last month names the wrong '
    'month for horizon=1, and get_sales_projections silently DROPS that row '
    'rather than erroring. Refreshed daily at 00:20 MYT by '
    'refresh-sales-projection-ensemble-daily for exactly that reason. '
    'cache_refreshed_at is the only staleness marker these forward rows carry.';

comment on function public.refresh_sales_projection_ensemble_cache() is
    'Refreshes private.mv_sales_projection_ensemble only, CONCURRENTLY. Run '
    'daily -- the ensemble reads the open order book, which moves whenever an '
    'order is keyed, and a stale cache names the wrong month for horizon=1. '
    'refresh_sales_projection_caches() calls this as its final step, so the '
    'monthly job still rebuilds everything in dependency order.';

comment on function public.refresh_sales_projection_caches() is
    'Refreshes all five projection caches in dependency order, ending with the '
    'published blend. Run after a month closes or after editing any model, '
    'calibration rule, weight rule or horizon set. Phase E schedules this '
    'monthly. Do NOT run it more often than its inputs change -- for the four '
    'backtest caches that is monthly, and churning scored history between it '
    'being read and being acted on is worse than a day of staleness. The fifth '
    'cache has a faster input (the order book) and its own daily job; that is '
    'the same rule applied, not an exception to it.';


-- ── VERIFY ──────────────────────────────────────────────────────────────────
--
--     select 'baseline' as cache, count(*) as rows,
--            count(distinct horizon) as horizons,
--            count(distinct method)  as methods,
--            min(period_month) as earliest, max(period_month) as latest
--     from private.mv_sales_projection_baseline
--     union all
--     select 'chainladder', count(*), count(distinct horizon), null,
--            min(origin_month), max(origin_month)
--     from private.mv_sales_chainladder_backtest;
--
-- Expect 12 horizons and 12 methods on the baseline cache (seasonal_naive,
-- seasonal_naive_drift, ma3, ma12, freqsev, drift, decomposition and
-- ses_010..ses_050). Fewer than 12 horizons means
-- sales_projection_baseline_view.sql was not re-run after the horizon
-- extension.
--
-- ── SECTION 6 -- RUN THESE BEFORE REPOINTING ANY RPC (2026-10-15) ──────────
--
-- A. Does the cache equal the view? Run BOTH SIDES IN ONE TRANSACTION -- the
--    order book commits between statements, and an uncommitted `except` will
--    show differences that are real churn, not cache error.
--
--     begin;
--     refresh materialized view concurrently private.mv_sales_projection_ensemble;
--
--     select 'cache, not view' as side, * from (
--       select period_month, horizon, projected, coverage, order_book_weight,
--              implied_from_order_book, implied_from_apriori, within_var,
--              between_var, total_var, sd, lo_80, hi_80, lo_95, hi_95,
--              composed_var, band_origins, model_detail
--       from private.mv_sales_projection_ensemble
--       except select * from public.v_sales_projection_ensemble) d
--     union all
--     select 'view, not cache', * from (
--       select * from public.v_sales_projection_ensemble
--       except
--       select period_month, horizon, projected, coverage, order_book_weight,
--              implied_from_order_book, implied_from_apriori, within_var,
--              between_var, total_var, sd, lo_80, hi_80, lo_95, hi_95,
--              composed_var, band_origins, model_detail
--       from private.mv_sales_projection_ensemble) d;
--     commit;
--
--    ZERO ROWS BOTH DIRECTIONS. The columns are listed explicitly because the
--    cache carries cache_refreshed_at and the view does not -- `except`
--    requires identical column lists. It also requires identical TYPES, so the
--    `::numeric` drift that cost a deploy cycle on lo_80 raises here rather
--    than passing silently.
--
-- B. The assertion that guards the entire frozen-calendar risk:
--
--     select count(*)                       as rows,
--            count(distinct horizon)        as horizons,
--            count(*) filter (where period_month <> (date_trunc('month', current_date)
--                     + (horizon || ' months')::interval)::date) as calendar_mismatches
--     from private.mv_sales_projection_ensemble;
--
--    Expect 12, 12, 0. A non-zero third column means the cache was built in a
--    previous month and NOTHING should be repointed at it until it is
--    refreshed -- see section 6's banner for what breaks silently.
--
-- C. That `concurrently` actually runs inside plpgsql on this server:
--
--     select public.refresh_sales_projection_ensemble_cache();
--
--    If it raises, drop the `concurrently` keyword from that function and
--    redeploy. Everything else in section 6 is unaffected by that choice.
-- ############################################################################
