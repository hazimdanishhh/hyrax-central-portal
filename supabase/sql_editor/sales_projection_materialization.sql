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
create or replace function public.refresh_sales_projection_caches()
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
    v_started timestamptz := clock_timestamp();
begin
    refresh materialized view private.mv_sales_order_development_pit;
    refresh materialized view private.mv_sales_chainladder_backtest;
    refresh materialized view private.mv_sales_projection_baseline;
    refresh materialized view private.mv_sales_projection_ensemble_backtest;

    return format(
        'refreshed in %s -- development rates %s rows, baseline %s rows, '
        'chainladder backtest %s rows, ensemble backtest %s rows',
        clock_timestamp() - v_started,
        (select count(*) from private.mv_sales_order_development_pit),
        (select count(*) from private.mv_sales_projection_baseline),
        (select count(*) from private.mv_sales_chainladder_backtest),
        (select count(*) from private.mv_sales_projection_ensemble_backtest)
    );
end;
$$;

revoke all on function public.refresh_sales_projection_caches() from public;
grant execute on function public.refresh_sales_projection_caches()
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

comment on function public.refresh_sales_projection_caches() is
    'Refreshes both projection backtest caches. Run after a month closes or '
    'after editing any model, calibration rule, weight rule or horizon set. '
    'Phase E schedules this monthly. Do NOT run it more often -- a projection '
    'whose history shifts between being read and being acted on is worse than '
    'one that is a day stale.';


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
-- ############################################################################
