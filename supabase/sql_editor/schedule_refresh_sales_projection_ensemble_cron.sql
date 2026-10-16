-- ############################################################################
-- refresh-sales-projection-ensemble-daily
--
-- Rebuilds private.mv_sales_projection_ensemble once a night.
--
-- Run AFTER sales_projection_materialization.sql section 6 exists.
--
-- ── THIS IS NOT A PERFORMANCE JOB. IT IS A CORRECTNESS JOB. ────────────────
--
-- The cache it refreshes freezes the calendar. v_sales_projection_ensemble
-- stores no dates -- every row's period_month is DERIVED at query time:
--
--     (date_trunc('month', current_date) + (horizon || ' months')::interval)
--
-- A live view can never be wrong about which month horizon=1 is. A cache can,
-- and will be, from midnight on the 1st of every month until this job fires.
--
-- And it fails silently. get_sales_projections_rpc.sql filters
-- `where p.period_month > c.cur_month` against a LIVE calendar, so a stale h=1
-- row is not rejected -- it is simply DROPPED. n_months falls by one, that
-- feeds span_origins' horizon filter, and the Full-Year outlook AND its 80%
-- band both move. Nothing raises, nothing logs.
--
-- ── WHY 00:20 MYT AND NOT 09:00 ────────────────────────────────────────────
--
-- 09:00 MYT is this estate's standing daily slot -- three jobs already run
-- there. It is also the worst possible slot for THIS job: it would leave nine
-- hours of wrong-month on the 1st of each month, starting at midnight and
-- running straight through the start of the Malaysian business day.
--
-- 00:20 MYT narrows that window to twenty minutes, and lands at the quietest
-- hour of the day. The twenty-minute offset (rather than 00:00) keeps it clear
-- of anything scheduled on the hour.
--
-- ── WHY DAILY, WHEN THE OTHER CACHES ARE MONTHLY ───────────────────────────
--
-- sales_projection_materialization.sql states the rule: do not refresh a cache
-- faster than its inputs change. For caches 0-3 that is monthly, because their
-- contents are a pure function of CLOSED months.
--
-- It is not true of this one. Tracing every input: baseline, ses, calibration
-- and the band quantiles all read monthly caches; freqsev and coverage read
-- SAP live but exclude the partial month. Exactly one input has no date filter
-- at all -- v_sales_orderbook_open -- and it moves whenever an order is keyed
-- or an invoice raised.
--
-- So daily is the same rule applied, not an exception to it.
--
-- Worth knowing what it actually buys: the order-book signal enters the blend
-- scaled by coverage(h), which is ~0.63 at h=1 and ~0.03 at h=12. This job
-- materially moves NEXT MONTH and very little else.
-- ############################################################################

create extension if not exists pg_cron;

select cron.schedule(
    'refresh-sales-projection-ensemble-daily',
    '20 16 * * *', -- 00:20 MYT (UTC+8) daily -- just after the month rolls over
    $$
    select public.refresh_sales_projection_ensemble_cache();
    $$
);

-- To check it's actually running: select * from cron.job_run_details
-- where jobid = (select jobid from cron.job
--                where jobname = 'refresh-sales-projection-ensemble-daily')
-- order by start_time desc limit 12;
--
-- To unschedule (e.g. to change the hour -- schedule() with the same job name
-- does NOT update it, unschedule then re-run the block above):
-- select cron.unschedule('refresh-sales-projection-ensemble-daily');
--
-- cron.unschedule() ERRORS on a job name that does not exist, so skip it on a
-- first-time deploy.

-- ── FIRST RUN, BY HAND ──────────────────────────────────────────────────────
--
-- The schedule above will not fire until tonight. Run it once now so the cache
-- is populated and current before anything is repointed at it:
--
--     select public.refresh_sales_projection_ensemble_cache();
--
-- Expect: 'ensemble cache refreshed in 00:00:04.x -- 12 rows, h=1 is <next
-- month>'. If h=1 names the CURRENT month, the cache is already stale and
-- nothing should be repointed until that is understood.

-- ── OVERLAP WITH THE MONTHLY JOB ───────────────────────────────────────────
--
-- On the 2nd of each month both jobs touch this cache -- this one at 00:20,
-- then snapshot-sales-projections-monthly at 09:00, whose
-- refresh_sales_projection_caches() rebuilds all five in dependency order.
--
-- That is deliberate, not a collision. The monthly job is authoritative: it
-- rebuilds the four backtest caches first, so the blend's interval width is
-- rebuilt on the new month's evidence before the snapshot freezes it. The
-- daily job's work is simply redone, nine hours later, correctly.
--
-- Both use `refresh ... concurrently` via the same function, so neither blocks
-- readers and they cannot deadlock -- PostgreSQL serialises concurrent
-- refreshes of one matview.

-- ── WHAT cron.job WILL SHOW ────────────────────────────────────────────────
--
-- This is the SECOND scheduled matview refresh in this repo and the 9th
-- file-tracked job. schedule_snapshot_sales_projections_cron.sql's header
-- claims "two firsts for this repo" (monthly cadence, scheduled matview
-- refresh) -- the second half of that claim is retired by this file.
--
-- cron.job will also show two jobs with no file in this repo (auto_clock_out's
-- 17:00 and 23:59 sweeps, created in the Supabase dashboard). Not strays.
-- ############################################################################
