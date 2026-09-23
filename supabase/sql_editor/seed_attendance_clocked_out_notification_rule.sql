-- Run this once in the Supabase SQL editor, after
-- notify_attendance_clocked_out.sql / trg_notify_attendance_clocked_out.sql
-- have been created.
--
-- SAFE TO RE-RUN as of 2026-09-23 -- it deletes the rule it is about to
-- insert. It was a bare INSERT, and the reason this was a separate file at all
-- was that re-running the sibling seed would have duplicated ITS rows. Every
-- notification seed is now idempotent, so that reasoning no longer applies --
-- though the split is harmless and is left as is.
--
-- Note the volume change on 2026-09-23: notify_attendance_clocked_out() now
-- returns early when the employee closed the session themselves, so this only
-- fires when the scanner, the end-of-day sweep, or another person ended it.
-- Email therefore stays on -- every remaining case is something that happened
-- TO them rather than something they did.
--
-- Targets the employee themselves, resolved fresh per event via
-- target_payload_keys -> employee_profile_id, same mechanism the other two
-- attendance notification rules already use.
delete from public.notification_rules where event_type = 'attendance.clocked_out_remote';

insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('attendance.clocked_out_remote', '{}'::jsonb, array['employee_profile_id'], array['in_app','email']);
