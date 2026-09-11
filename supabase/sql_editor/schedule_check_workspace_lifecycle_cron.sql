-- Run this once in the Supabase SQL editor, AFTER
-- check_project_deadlines_approaching.sql, check_projects_overdue.sql,
-- check_tasks_due_soon.sql, and check_tasks_overdue.sql have all been
-- created, and after their notification_rules rows exist (see
-- seed_project_lifecycle_notification_rules.sql /
-- seed_task_lifecycle_notification_rules.sql).
--
-- Kept as its own job, separate from check-employee-lifecycle-daily --
-- different table domain (projects/tasks, not employees) -- rather than
-- appended to that job's body, matching this repo's existing convention
-- of one cron job per table domain (see
-- schedule_check_attendance_approvals_cron.sql as the other example of a
-- domain with its own job).
--
-- Never leaves Postgres -- no pg_net/HTTP call, no Edge Function, no
-- secret to store in Vault -- straight pg_cron call into plpgsql
-- functions, same shape as schedule_check_employee_confirmations_cron.sql.
create extension if not exists pg_cron;

select cron.schedule(
    'check-workspace-lifecycle-daily',
    '0 1 * * *', -- 09:00 MYT (UTC+8) daily -- same slot as the HR/attendance scans
    $$
    select public.check_project_deadlines_approaching();
    select public.check_projects_overdue();
    select public.check_tasks_due_soon();
    select public.check_tasks_overdue();
    $$
);

-- To check it's actually running: select * from cron.job_run_details
-- order by start_time desc limit 20;
-- To unschedule (e.g. to change the time -- schedule() with the same job
-- name does not update it, unschedule then re-run the block above):
-- select cron.unschedule('check-workspace-lifecycle-daily');
