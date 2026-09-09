-- Run this once in the Supabase SQL editor, AFTER
-- check_attendance_autoclockout_approaching_evening.sql and
-- check_attendance_autoclockout_approaching_midnight.sql have been created.
--
-- Two separate cron jobs, ~15 minutes before each of the two real,
-- already-live auto_clock_out() cutoffs (5:00 PM MYT and 11:59 PM MYT --
-- confirmed against the live cron jobs already scheduled against
-- auto_clock_out(), not this repo's own docs, which only ever documented
-- the 11:59 PM one). Pure-Postgres, same shape as
-- schedule_check_attendance_approvals_cron.sql -- no pg_net/Edge Function
-- needed, since the check never leaves Postgres. Does NOT touch the
-- existing auto_clock_out() cron entries -- these are new, separate job
-- names scheduling different functions.
create extension if not exists pg_cron;

select cron.schedule(
    'check-attendance-autoclockout-approaching-evening',
    '45 8 * * *', -- 16:45 MYT (UTC+8) daily -- 15 min before the 5:00 PM cutoff
    $$ select public.check_attendance_autoclockout_approaching_evening(); $$
);

select cron.schedule(
    'check-attendance-autoclockout-approaching-midnight',
    '44 15 * * *', -- 23:44 MYT (UTC+8) daily -- 15 min before the 11:59 PM cutoff
    $$ select public.check_attendance_autoclockout_approaching_midnight(); $$
);

-- To check they're actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the time -- schedule() with the same job
-- name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('check-attendance-autoclockout-approaching-evening');
-- select cron.unschedule('check-attendance-autoclockout-approaching-midnight');
