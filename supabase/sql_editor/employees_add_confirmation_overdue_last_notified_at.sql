-- Run this once in the Supabase SQL editor.
--
-- Cooldown guard for the "confirmation overdue" scheduled scan (see
-- check_employee_confirmations_overdue.sql) -- NOT a one-shot dedup like
-- confirmation_reminder_sent_at. An overdue confirmation is an ongoing,
-- unresolved backlog state, worth re-nagging about periodically until
-- fixed -- this column tracks the last time we did, so the scan can
-- re-notify after a cooldown window instead of either spamming daily or
-- only ever firing once.
alter table public.employees
    add column if not exists confirmation_overdue_last_notified_at timestamptz;
