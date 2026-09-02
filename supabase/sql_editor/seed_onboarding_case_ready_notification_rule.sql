-- Run this once in the Supabase SQL editor, after re-running
-- supabase/functions/notify_employee_profile_linked.sql (create or
-- replace, safe to re-run -- adds a second, conditional
-- emit_notification_event() call it previously never made).
--
-- Seeded active immediately -- Shape A, fires only when a profile is
-- freshly linked (or re-linked) to an employee that has a genuinely OPEN
-- onboarding case at that moment, so there's no backfill flood risk.
insert into public.notification_rules (event_type, target_departments, target_roles, target_payload_keys, channels)
values
    ('employee.onboarding_case_ready',
        array[]::text[], array[]::text[], array['new_profile_id'], array['in_app', 'email']);
