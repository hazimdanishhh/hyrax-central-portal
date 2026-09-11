-- In-app + email, matching every existing Workspace rule. Single-recipient
-- event (the document's original uploader), resolved via
-- target_payload_keys exactly like document.attached's per-recipient
-- loop calls already do.
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('document.removed', '{}'::jsonb, array['attached_by_profile_id'], array['in_app','email']);
