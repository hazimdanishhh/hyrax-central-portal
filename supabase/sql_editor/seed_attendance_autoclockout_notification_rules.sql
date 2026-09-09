-- Run this once in the Supabase SQL editor, after
-- notify_attendance_clocked_in.sql / trg_notify_attendance_clocked_in.sql
-- and both check_attendance_autoclockout_approaching_*.sql functions +
-- their cron schedule have been created.
--
-- Both new events target the employee themselves, resolved fresh per event
-- via target_payload_keys -> employee_profile_id -- same mechanism
-- employee.confirmation_due_soon uses for manager_profile_id, just pointed
-- at the employee's own profile instead. No target_roles/target_departments
-- needed -- this is a personal reminder/confirmation, not a departmental
-- one, so condition stays '{}'::jsonb (always matches).
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('attendance.clocked_in_remote', '{}'::jsonb, array['employee_profile_id'], array['in_app','email']),
  ('attendance.autoclockout_approaching', '{}'::jsonb, array['employee_profile_id'], array['in_app','email']);
