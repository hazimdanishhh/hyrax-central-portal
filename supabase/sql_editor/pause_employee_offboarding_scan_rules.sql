-- Run this once in the Supabase SQL editor, immediately after
-- seed_employee_lifecycle_notification_rules.sql -- before running the
-- backfill or turning the cron job on for real.
--
-- Mirrors pause_confirmation_status_mismatch_rule.sql exactly: real
-- employees may already be mid-notice-period at deploy time (that's
-- exactly what the backfill, backfill_employee_lifecycle_cases.sql, will
-- surface), and the very first cron tick after the backfill would
-- otherwise flood HR/IT with day-one notifications for work that's
-- actually been in progress for weeks. Both events are recurring/cooldown-
-- based, not one-shot, so running the scan while paused is safe -- it
-- still writes the cooldown timestamp, usefully staggering the first REAL
-- notification once re-enabled rather than firing immediately for every
-- backfilled case at once.
--
-- To re-enable, once HR/IT have reviewed the backfilled offboarding cases:
--   update public.notification_rules set is_active = true
--   where event_type in ('employee.offboarding_last_day_approaching', 'employee.offboarding_overdue');
update public.notification_rules
set is_active = false
where event_type in ('employee.offboarding_last_day_approaching', 'employee.offboarding_overdue');
