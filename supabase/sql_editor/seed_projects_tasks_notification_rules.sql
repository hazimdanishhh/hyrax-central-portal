-- In-app + email, per the confirmed decision -- matches how every other
-- assignment-style event in this app already behaves.
--
-- A task.status_changed event is deliberately NOT seeded here: its
-- natural audience ("everyone currently in this project's membership
-- except whoever made the change") has no clean fit in
-- fan_out_notification_event()'s targeting model today --
-- target_payload_keys resolves one payload key to one profiles.id, not a
-- dynamic list of current members. Extending that shared engine (used by
-- every other module's notifications) to accept an array-valued payload
-- key is a small, scoped, backward-compatible follow-up -- worth flagging
-- for a future pass, not bundling into this module's migration. The
-- notify_task_status_changed() trigger, if built, is harmless to leave
-- firing with zero matching rules -- it just won't notify anyone until a
-- rule exists.
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('task.assigned', '{}'::jsonb, array['assignee_profile_id'], array['in_app','email']),
  ('project.member_added', '{}'::jsonb, array['member_profile_id'], array['in_app','email']);
