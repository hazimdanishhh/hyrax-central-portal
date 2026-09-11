-- In-app + email for all, matching every existing Workspace rule.
--
-- project.member_removed / project.member_role_changed /
-- project.ownership_transferred are single-recipient events, resolved via
-- target_payload_keys exactly like project.member_added already is.
--
-- project.deadline_approaching / project.overdue are dynamic
-- multi-recipient events (every current project member, any role) --
-- audience is resolved by looping project_members INSIDE the scan
-- function itself (see check_project_deadlines_approaching.sql /
-- check_projects_overdue.sql), not by target_roles/target_departments
-- here -- so condition stays '{}'::jsonb and target_payload_keys just
-- picks up the one recipient_profile_id key each looped
-- emit_notification_event() call carries, the same mechanism
-- project.status_changed already uses.
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('project.member_removed', '{}'::jsonb, array['member_profile_id'], array['in_app','email']),
  ('project.member_role_changed', '{}'::jsonb, array['member_profile_id'], array['in_app','email']),
  ('project.ownership_transferred', '{}'::jsonb, array['new_owner_profile_id'], array['in_app','email']),
  ('project.deadline_approaching', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']),
  ('project.overdue', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']);
