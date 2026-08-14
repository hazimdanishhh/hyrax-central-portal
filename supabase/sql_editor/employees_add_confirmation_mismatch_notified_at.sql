-- Run this once in the Supabase SQL editor.
--
-- One-shot dedup guard for the "confirmation status mismatch" scheduled
-- scan (see check_employee_confirmation_status_mismatches.sql). Unlike the
-- overdue-confirmation cooldown, this is a rare data-hygiene anomaly (an
-- employee moved off Probation without ever being confirmed), not an
-- expected recurring queue -- notify HR once, they investigate/fix it.
alter table public.employees
    add column if not exists confirmation_mismatch_notified_at timestamptz;
