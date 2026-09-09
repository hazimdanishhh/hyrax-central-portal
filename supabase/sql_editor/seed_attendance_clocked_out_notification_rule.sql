-- Run this once in the Supabase SQL editor, after
-- notify_attendance_clocked_out.sql / trg_notify_attendance_clocked_out.sql
-- have been created.
--
-- A new, separate file rather than appending to
-- seed_attendance_autoclockout_notification_rules.sql -- that file has
-- already been executed, and re-running it would duplicate its two
-- already-seeded rows (double-firing those two existing notifications).
--
-- Targets the employee themselves, resolved fresh per event via
-- target_payload_keys -> employee_profile_id, same mechanism the other two
-- attendance notification rules already use.
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('attendance.clocked_out_remote', '{}'::jsonb, array['employee_profile_id'], array['in_app','email']);
