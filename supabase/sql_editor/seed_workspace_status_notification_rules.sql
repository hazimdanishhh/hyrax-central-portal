-- In-app + email for all three, per the confirmed UAT decision -- matches
-- how every other event in this app defaults (task.assigned,
-- project.member_added, lead.stage_changed all use in_app+email).
--
-- Audience for all three is resolved by looping task_assignees/
-- project_members INSIDE the trigger function itself (see
-- notify_document_attached.sql / notify_project_status_changed.sql /
-- notify_task_status_changed.sql), not by target_roles/target_departments
-- here -- so condition stays '{}'::jsonb (always matches) and
-- target_payload_keys just picks up the one recipient_profile_id key each
-- looped emit_notification_event() call carries, the same mechanism
-- assignee_profile_id/member_profile_id already use in
-- seed_projects_tasks_notification_rules.sql.
--
-- Known trade-off: because the recipient SET is a SQL query inside the
-- trigger function (not target_roles/target_departments data), widening or
-- narrowing who gets notified later means editing that function, not just
-- this rule row -- the same kind of hardcoded-audience limitation
-- task.assigned/project.member_added already have, just now also applying
-- to a dynamic multi-recipient case.
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('document.attached', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']),
  ('project.status_changed', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']),
  ('task.status_changed', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']);
