-- Run this in the Supabase SQL editor, after
-- notify_attendance_clocked_in.sql / trg_notify_attendance_clocked_in.sql and
-- both check_attendance_autoclockout_approaching_*.sql functions + their cron
-- schedule have been created.
--
-- SAFE TO RE-RUN as of 2026-09-23 -- it deletes the rules it is about to
-- insert. It was a bare INSERT, which meant a second run silently created
-- DUPLICATE rules, and a duplicate rule sends a duplicate notification to
-- everyone it matches, on every event, forever.
--
-- Both events target the employee themselves, resolved fresh per event via
-- target_payload_keys -> employee_profile_id. No target_roles /
-- target_departments -- these are personal, not departmental -- so condition
-- stays '{}'::jsonb (always matches).

delete from public.notification_rules
where event_type in (
    'attendance.clocked_in_remote',
    'attendance.autoclockout_approaching'
);

insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  -- IN-APP ONLY (changed 2026-09-23 -- was in_app + email).
  --
  -- This fires when the employee clocks in through the app, i.e. immediately
  -- after they pressed the button themselves. An in-app confirmation is
  -- reasonable -- it is a receipt, and it is free to ignore. An EMAIL for it
  -- is not: it lands in their inbox every single working morning to tell them
  -- something they did three seconds ago and already saw on screen. That is
  -- the kind of notification people build filters to delete, which then
  -- silently buries the ones that matter.
  ('attendance.clocked_in_remote', '{}'::jsonb, array['employee_profile_id'], array['in_app']),

  -- IN-APP + EMAIL, deliberately. This one is a deadline warning with an
  -- action attached: clock out yourself, or the system does it for you at the
  -- cutoff. It fires at most once per session per cutoff, and as of
  -- 2026-09-23 it is one notification per EMPLOYEE rather than one per open
  -- session, so an employee with two sessions running no longer receives two
  -- identical warnings in the same minute.
  ('attendance.autoclockout_approaching', '{}'::jsonb, array['employee_profile_id'], array['in_app','email']);
