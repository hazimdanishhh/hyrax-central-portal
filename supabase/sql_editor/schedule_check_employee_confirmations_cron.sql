-- Run this once in the Supabase SQL editor, AFTER
-- check_employee_confirmations_due_soon.sql has been created.
--
-- Unlike schedule_send_queued_emails_cron.sql, this never leaves Postgres --
-- no pg_net/HTTP call, no Edge Function, no secret to store in Vault. It's
-- a straight pg_cron call into a plpgsql function, since the whole job
-- (scanning employees, emitting events, updating the dedup flag) is pure
-- SQL. Once a day is plenty for a 30-day "due soon" window -- there's no
-- value in checking more often than that.
create extension if not exists pg_cron;

select cron.schedule(
    'check-employee-confirmations-due-soon-daily',
    '0 1 * * *', -- 09:00 MYT (UTC+8) daily -- adjust to taste
    $$ select public.check_employee_confirmations_due_soon(); $$
);

-- To check it's actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the time -- schedule() with the same job
-- name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('check-employee-confirmations-due-soon-daily');
