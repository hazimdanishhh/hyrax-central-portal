-- Run this once in the Supabase SQL editor, AFTER
-- check_attendance_approvals_pending.sql has been created.
--
-- Kept as its own cron job, separate from check-employee-lifecycle-daily --
-- different table/domain (attendance_activities, not employees). Same
-- pure-Postgres shape as that job: no pg_net/HTTP call, no Edge Function.
create extension if not exists pg_cron;

select cron.schedule(
    'check-attendance-approvals-pending-daily',
    '0 1 * * *', -- 09:00 MYT (UTC+8) daily -- adjust to taste; this could
                 -- reasonably run more often than once a day if a pending
                 -- approval backlog turns out to need faster escalation
    $$ select public.check_attendance_approvals_pending(); $$
);

-- To check it's actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the time -- schedule() with the same job
-- name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('check-attendance-approvals-pending-daily');
