-- Monthly: refresh the projection caches, then freeze the forecast.
--
-- Run this once in the Supabase SQL editor, AFTER
-- supabase/sql_editor/sales_projection_snapshots_migration.sql and
-- supabase/functions/snapshot_sales_projections.sql.
--
-- ── TWO FIRSTS FOR THIS REPO ────────────────────────────────────────────────
--
-- The first MONTHLY job (the longest cadence until now was the weekly payroll
-- reconciliation), and the first scheduled MATERIALIZED VIEW refresh. Until
-- today the projection caches went stale silently until somebody remembered
-- to run the refresh by hand.
--
-- ── THE ORDER INSIDE THE JOB IS LOAD-BEARING ────────────────────────────────
--
-- Refresh first, snapshot second. A snapshot taken before the caches have seen
-- the newly closed month would freeze LAST month's view of the world and
-- label it this month's forecast.
--
-- That fault is undetectable afterwards. The row looks perfectly ordinary; it
-- is simply wrong about when it was true, and every accuracy figure computed
-- from it would be measuring the wrong thing. Two statements in one job, in
-- this order, is the only arrangement that cannot produce it.
--
-- ── WHY THE 2nd, NOT THE 1st ────────────────────────────────────────────────
--
-- SAP is still closing out the previous month on day one. We watched this
-- happen: between 2 and 14 October the age-0 conversion rate moved from 0.3442
-- to 0.3510 as September invoices continued to arrive. A snapshot on the 1st
-- would freeze a half-closed month and call it final.
--
-- The 2nd is a compromise, not a guarantee -- late invoices keep trickling in
-- for longer than that. It is far enough in to catch the bulk, and early
-- enough that the month's forecast is still about the future.
-- ############################################################################

create extension if not exists pg_cron;

select cron.schedule(
    'snapshot-sales-projections-monthly',
    '0 1 2 * *', -- 09:00 MYT (UTC+8), 2nd of each month
    $$
    select public.refresh_sales_projection_caches();
    select public.snapshot_sales_projections();
    $$
);

-- To check it's actually running: select * from cron.job_run_details
-- where jobid = (select jobid from cron.job
--                where jobname = 'snapshot-sales-projections-monthly')
-- order by start_time desc limit 12;
--
-- To unschedule (e.g. to change the day -- schedule() with the same job name
-- does NOT update it, unschedule then re-run the block above):
-- select cron.unschedule('snapshot-sales-projections-monthly');
--
-- cron.unschedule() ERRORS on a job name that does not exist, so skip it on a
-- first-time deploy.

-- ── FIRST RUN, BY HAND ──────────────────────────────────────────────────────
--
-- The schedule above will not fire until the 2nd of next month. To get the
-- current month on record now, run this once as superadmin:
--
--     select public.snapshot_sales_projections();
--
-- It is safe to run at any point in the month and safe to repeat -- a second
-- call in the same month is a no-op. Note only that a mid-month first snapshot
-- is taken from a slightly later vantage point than the scheduled ones will
-- be; `created_at` records when, so the difference stays visible.
--
-- ── WHAT cron.job WILL SHOW ─────────────────────────────────────────────────
--
-- More jobs than this repo has files for. Two live jobs (auto_clock_out's
-- 17:00 and 23:59 sweeps) were created directly in the Supabase dashboard and
-- were never captured in schedule_*_cron.sql. They are not strays.
-- ############################################################################
