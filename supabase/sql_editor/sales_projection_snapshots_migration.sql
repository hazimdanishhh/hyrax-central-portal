-- sales_projection_snapshots: what the forecast actually SAID, frozen the day
-- it said it.
--
-- Phase E of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md. Named in
-- architecture §8.6.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
--
-- v_sales_projection_ensemble recomputes on every page load. Last month's
-- figure for November is gone the moment November's actuals arrive, because
-- the view rebuilds itself from the data as it now stands.
--
-- So "how accurate is this forecast" currently has no honest answer. It can
-- only be RECONSTRUCTED -- rebuilt today from history -- and the stage-2 work
-- showed exactly why that is not good enough: the settings behind the
-- reconstruction were chosen knowing how those months turned out. The
-- reconstruction flatters itself by an amount nobody can measure.
--
-- A frozen record is the only thing that fixes it. From the first snapshot
-- onward, accuracy is measured against what was genuinely published.
--
-- ── EVERY HORIZON, NOT JUST THE PUBLISHED ONES ──────────────────────────────
--
-- Twelve rows a month, 144 a year. Trivially small, and impossible to recover
-- later. The dashboard publishes six horizons; the other six are stored anyway,
-- because they are what will eventually show whether h=7-12 becomes
-- publishable as history accumulates.
--
-- ── RUN ORDER ───────────────────────────────────────────────────────────────
--
-- Run this once in the Supabase SQL editor, AFTER
-- sales_projection_ensemble_view.sql exists. Then:
--     supabase/functions/snapshot_sales_projections.sql
--     supabase/sql_editor/schedule_snapshot_sales_projections_cron.sql
-- ############################################################################

create table if not exists public.sales_projection_snapshots (
    id                        bigint generated always as identity primary key,

    -- WHEN the forecast was made, and WHAT it was forecasting. Both are month
    -- starts; horizon is period_month minus snapshot_month in months, stored
    -- rather than derived so a query can filter on it without date maths.
    snapshot_month            date   not null,
    period_month              date   not null,
    horizon                   int    not null,

    -- The published figures, exactly as the dashboard showed them.
    projected                 numeric not null,
    lo_80                     numeric,
    hi_80                     numeric,
    lo_95                     numeric,
    hi_95                     numeric,

    -- The split behind the number, so a miss can be attributed rather than
    -- merely noted. If a forecast was wrong, this says whether the order book
    -- or the statistical side was responsible.
    implied_from_order_book   numeric,
    implied_from_apriori      numeric,
    coverage                  numeric,
    order_book_weight         numeric,

    -- Every model's own estimate at the time.
    model_detail              jsonb,

    -- WHICH CONFIGURATION PRODUCED THIS. Not optional.
    --
    -- Over six weeks this project changed the blend weight twice, the
    -- calibration window twice, the band's shape once, and the backtest window
    -- once. A snapshot that does not record its own settings cannot be
    -- compared against one taken either side of a change -- you would be
    -- measuring the configuration, not the forecast.
    config                    jsonb  not null,

    created_at                timestamptz not null default now(),

    -- One forecast per horizon per month. The cron firing twice, or a manual
    -- run after an automatic one, must not be able to write a second version
    -- of history.
    unique (snapshot_month, horizon)
);

-- The accuracy view joins on period_month to find closed months; the Track
-- Record section filters a fiscal year and orders by month. Covered here.
create index if not exists sales_projection_snapshots_period_idx
    on public.sales_projection_snapshots (period_month, horizon);


-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- ⚠ READ supabase/policies/reconciliation_results_access.sql BEFORE CHANGING
-- THESE. It records that pipeline_run_log was created superadmin-only, the
-- dashboard banner reading it silently returned ZERO ROWS for every
-- non-superadmin, and a workaround view had to be written later to undo it.
-- "Same class of table, same audience; don't repeat it."
--
-- This is that class exactly: written by a scheduled job, read by a dashboard.
-- get_sales_projection_accuracy() is SECURITY INVOKER, so the read happens as
-- the calling manager. A policy they do not satisfy produces an empty section
-- with no error anywhere -- the hardest kind of fault to notice.
--
-- Policy names follow the Sales dialect from
-- supabase/policies/sales_targets_budgets_crud.sql: the name states its own
-- audience and access level, and no policy grants more than its name implies.
alter table public.sales_projection_snapshots enable row level security;

drop policy if exists "Sales Department VIEW" on public.sales_projection_snapshots;
create policy "Sales Department VIEW" on public.sales_projection_snapshots
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'SAL'
  )
);

drop policy if exists "MGM Department VIEW" on public.sales_projection_snapshots;
create policy "MGM Department VIEW" on public.sales_projection_snapshots
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    join public.departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Superadmin CRUD" on public.sales_projection_snapshots;
create policy "Superadmin CRUD" on public.sales_projection_snapshots
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);

-- NO insert/update/delete policy for `authenticated`, deliberately.
--
-- The only writer is snapshot_sales_projections(), which is SECURITY DEFINER
-- and bypasses RLS. A hand-edited snapshot is not a correction, it is a
-- falsified record of what was forecast -- and the entire value of this table
-- is that nobody can revise it after the fact.


comment on table public.sales_projection_snapshots is
    'Frozen monthly record of what v_sales_projection_ensemble published, one '
    'row per horizon. Exists because the view recomputes on every page load, '
    'so without this, forecast accuracy can only be reconstructed -- and a '
    'reconstruction built with hindsight flatters itself. Written only by '
    'snapshot_sales_projections() under pg_cron. 144 rows a year.';


-- ── VERIFY ──────────────────────────────────────────────────────────────────
--
--     select policyname, cmd
--     from pg_policies
--     where schemaname = 'public' and tablename = 'sales_projection_snapshots'
--     order by policyname;
--
-- Expect exactly three: "MGM Department VIEW" (SELECT), "Sales Department
-- VIEW" (SELECT), "Superadmin CRUD" (ALL). An INSERT policy appearing here
-- means someone has given a human the ability to rewrite history.
--
-- ⚠ The SQL editor runs as owner and BYPASSES RLS, so these policies cannot be
-- tested from it. Confirm a real SAL manager can select from the table through
-- the app before trusting them -- that is precisely how the pipeline_run_log
-- fault went unnoticed.
-- ############################################################################
