-- Run this once in the Supabase SQL editor, before creating
-- check_employee_offboarding_hr_items_approaching.sql.
--
-- Own cooldown column for the new HR-side reminder, kept separate from
-- it_revocation_reminder_last_notified_at so the two scans (IT items vs HR
-- items) never contend over the same dedup timestamp -- a case can easily
-- have both IT and HR items still open at once, each needing its own
-- independent 3-day cooldown.
alter table public.employee_lifecycle_cases
add column if not exists hr_items_reminder_last_notified_at timestamptz;
