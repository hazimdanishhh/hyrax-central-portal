-- Run this once in the Supabase SQL editor, AFTER
-- check_employee_confirmations_due_soon.sql, check_employee_confirmations_overdue.sql,
-- and check_employee_contract_actions_due.sql have all been created.
--
-- check_employee_confirmation_status_mismatches() is deliberately NOT
-- called here -- it's paused (see pause_confirmation_status_mismatch_rule.sql)
-- because most migrated active employees have no confirmation_date at all,
-- which would flood this one-shot check with false positives and
-- permanently burn each employee's single notification opportunity on
-- migration noise. Re-add a `select public.check_employee_confirmation_status_mismatches();`
-- line here once the historical data gap is actually fixed.
--
-- check_employee_offboarding_last_day_approaching()/check_employee_offboarding_overdue()
-- (added 2026-09, Employee Lifecycle Checklist module) share this same job
-- rather than getting their own -- same table domain (employees/
-- employee_lifecycle_cases), same daily cadence as the three functions
-- already here. Their notification_rules rows were seeded paused (see
-- pause_employee_offboarding_scan_rules.sql) until the deploy-time backfill
-- was reviewed -- running them here regardless was safe even while paused,
-- since a paused rule's fan-out is a no-op but the scan still advances its
-- own cooldown timestamps. Re-enabled 2026-09-02 via
-- resume_employee_offboarding_scan_rules.sql ahead of UAT.
--
-- check_employee_offboarding_hr_items_approaching() (added 2026-09-02, UAT
-- readiness pass) mirrors check_employee_offboarding_last_day_approaching()
-- but scoped to HR-owned items instead of IT-owned, with its own cooldown
-- column -- closes the gap where only IT had a proactive pre-last-day
-- reminder. Seeded active immediately, no pause needed (see
-- seed_offboarding_hr_items_approaching_notification_rule.sql).
--
-- UPGRADING FROM AN EARLIER VERSION OF THIS FILE (skip this if this is the
-- first time 'check-employee-lifecycle-daily' is being scheduled at all --
-- cron.unschedule() errors on a job name that doesn't exist yet):
-- - If you're still on the very first version, this job used to only call
--   check_employee_confirmations_due_soon() under the name
--   'check-employee-confirmations-due-soon-daily' -- unschedule that name
--   first: select cron.unschedule('check-employee-confirmations-due-soon-daily');
-- - If you're already on 'check-employee-lifecycle-daily' under ANY earlier
--   version of this file's body, the job NAME hasn't changed here, but its
--   body has -- cron.schedule() with the same name does NOT update an
--   existing job, so unschedule it first either way:
--   select cron.unschedule('check-employee-lifecycle-daily');
--
-- check_employee_contract_offboarding_due() (added 2026-09) closes the
-- "contract employees get no offboarding lead time" gap -- see
-- docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 3. Deliberately
-- placed after check_employee_contract_actions_due() in the body (not that
-- it matters for correctness -- each function is independently
-- transactional and dedup-guarded -- just readability: the reminder and
-- the case-opening scan over the same population sit next to each other).
--
-- Unlike schedule_send_queued_emails_cron.sql, this never leaves Postgres --
-- no pg_net/HTTP call, no Edge Function, no secret to store in Vault. It's
-- a straight pg_cron call into plpgsql functions, since the whole job
-- (scanning employees, emitting events, updating dedup/cooldown columns)
-- is pure SQL. All seven scan the same table domain on the same daily
-- cadence, so they share one cron job rather than seven separate ones.
--
-- UPGRADING FROM AN EARLIER VERSION OF THIS FILE (skip this if this is the
-- first time 'check-employee-lifecycle-daily' is being scheduled at all --
-- cron.unschedule() errors on a job name that doesn't exist yet): the job
-- NAME hasn't changed here (still just adding a 7th call to the body), but
-- cron.schedule() with the same name does NOT update an existing job's
-- body -- unschedule it first: select cron.unschedule('check-employee-lifecycle-daily');
create extension if not exists pg_cron;

select cron.schedule(
    'check-employee-lifecycle-daily',
    '0 1 * * *', -- 09:00 MYT (UTC+8) daily -- adjust to taste
    $$
    select public.check_employee_confirmations_due_soon();
    select public.check_employee_confirmations_overdue();
    select public.check_employee_contract_actions_due();
    select public.check_employee_contract_offboarding_due();
    select public.check_employee_offboarding_last_day_approaching();
    select public.check_employee_offboarding_overdue();
    select public.check_employee_offboarding_hr_items_approaching();
    $$
);

-- To check it's actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the time -- schedule() with the same job
-- name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('check-employee-lifecycle-daily');
