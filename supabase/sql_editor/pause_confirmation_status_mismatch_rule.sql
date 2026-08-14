-- Run this once in the Supabase SQL editor.
--
-- Defensive second layer on top of removing check_employee_confirmation_status_mismatches()
-- from the daily cron (see schedule_check_employee_confirmations_cron.sql) --
-- most migrated active employees have no confirmation_date at all, so this
-- one-shot check would flood HR with false positives and permanently burn
-- each employee's single notification opportunity on migration noise, not
-- a real process gap. Nothing is deleted -- the function, column, and this
-- rule row all stay in place, just inactive.
--
-- To re-enable later (once historical confirmation_date data is backfilled,
-- or a migration-cutover exclusion is added to the function itself):
--   update public.notification_rules set is_active = true
--   where event_type = 'employee.confirmation_status_mismatch';
-- and re-add the function call to the cron job's body.
update public.notification_rules
set is_active = false
where event_type = 'employee.confirmation_status_mismatch';
