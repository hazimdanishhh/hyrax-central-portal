-- In-app + email, per the confirmed decision -- matches how every other
-- assignment-style event in this app already behaves.
--
-- task.status_changed (plus project.status_changed and document.attached)
-- was deliberately NOT seeded here: their natural audience ("everyone
-- currently in this project's membership/task's assignees, except
-- whoever made the change") had no clean fit in
-- fan_out_notification_event()'s targeting model -- target_payload_keys
-- resolves one payload key to one profiles.id, not a dynamic list. Rather
-- than extending the shared engine, that gap was closed by having each of
-- those three triggers loop over its recipients and call
-- emit_notification_event() once per recipient -- see
-- notify_task_status_changed.sql / notify_project_status_changed.sql /
-- notify_document_attached.sql and their rules in
-- seed_workspace_status_notification_rules.sql.
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('task.assigned', '{}'::jsonb, array['assignee_profile_id'], array['in_app','email']),
  ('project.member_added', '{}'::jsonb, array['member_profile_id'], array['in_app','email']);
