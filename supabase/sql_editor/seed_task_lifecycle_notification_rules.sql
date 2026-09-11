-- In-app + email for all, matching every existing Workspace rule.
--
-- task.unassigned is single-recipient (target_payload_keys), mirrors
-- task.assigned exactly.
--
-- task.due_date_changed / task.deleted are dynamic multi-recipient
-- events (current task assignees, excluding the actor) -- audience
-- resolved by looping task_assignees INSIDE the trigger function itself
-- (see notify_task_due_date_changed.sql / notify_task_deleted.sql), same
-- mechanism task.status_changed already uses.
--
-- task.due_soon / task.overdue are per-(task, assignee)-pair scheduled
-- scans -- see check_tasks_due_soon.sql / check_tasks_overdue.sql.
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('task.unassigned', '{}'::jsonb, array['assignee_profile_id'], array['in_app','email']),
  ('task.due_date_changed', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']),
  ('task.due_soon', '{}'::jsonb, array['assignee_profile_id'], array['in_app','email']),
  ('task.overdue', '{}'::jsonb, array['assignee_profile_id'], array['in_app','email']),
  ('task.deleted', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']);
