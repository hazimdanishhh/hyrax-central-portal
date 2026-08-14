-- Run this once in the Supabase SQL editor, AFTER
-- check_employee_confirmations_due_soon.sql, check_employee_confirmations_overdue.sql,
-- check_employee_confirmation_status_mismatches.sql, and
-- check_employee_contract_actions_due.sql have all been created.
--
-- UPGRADING FROM THE ORIGINAL VERSION OF THIS FILE: this job used to only
-- call check_employee_confirmations_due_soon() under the name
-- 'check-employee-confirmations-due-soon-daily'. Re-running cron.schedule()
-- with a DIFFERENT job name does not touch that old job -- if it's already
-- live, unschedule it first:
-- select cron.unschedule('check-employee-confirmations-due-soon-daily');
--
-- Unlike schedule_send_queued_emails_cron.sql, this never leaves Postgres --
-- no pg_net/HTTP call, no Edge Function, no secret to store in Vault. It's
-- a straight pg_cron call into four plpgsql functions, since the whole job
-- (scanning employees, emitting events, updating dedup/cooldown columns)
-- is pure SQL. All four scan the same table on the same daily cadence, so
-- they share one cron job rather than four separate ones.
create extension if not exists pg_cron;

select cron.schedule(
    'check-employee-lifecycle-daily',
    '0 1 * * *', -- 09:00 MYT (UTC+8) daily -- adjust to taste
    $$
    select public.check_employee_confirmations_due_soon();
    select public.check_employee_confirmations_overdue();
    select public.check_employee_confirmation_status_mismatches();
    select public.check_employee_contract_actions_due();
    $$
);

-- To check it's actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the time -- schedule() with the same job
-- name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('check-employee-lifecycle-daily');
