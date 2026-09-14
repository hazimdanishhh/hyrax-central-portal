-- Run this once in the Supabase SQL editor, AFTER
-- send_payroll_reconciliation_notifications.sql,
-- send_payroll_reconciliation_hr_digest.sql, and
-- seed_payroll_reconciliation_notification_rules.sql.
--
-- First WEEKLY cron job in this repo. Both functions stacked in one job
-- body, same convention as check-employee-lifecycle-daily stacking
-- multiple same-domain/same-cadence checks. Each function wraps its own
-- body in an exception handler, so neither can abort the other.
create extension if not exists pg_cron;

select cron.schedule(
    'send-payroll-reconciliation-notifications-weekly',
    '0 1 * * 1', -- 09:00 MYT (UTC+8), every Monday -- adjustable, not a confirmed HR preference
    $$
    select public.send_payroll_reconciliation_notifications();
    select public.send_payroll_reconciliation_hr_digest();
    $$
);

-- To check it's actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the time -- schedule() with the same job
-- name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('send-payroll-reconciliation-notifications-weekly');
