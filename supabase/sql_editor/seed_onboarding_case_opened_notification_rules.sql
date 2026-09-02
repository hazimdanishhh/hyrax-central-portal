-- Run this once in the Supabase SQL editor, after re-running
-- supabase/functions/handle_employee_onboarding_case_open.sql (create or
-- replace, safe to re-run -- adds the two emit_notification_event() calls
-- it previously never made).
--
-- Both seeded active immediately -- these are Shape A, change-triggered
-- only by a genuinely NEW employees row INSERT. The one-time backfill
-- (backfill_employee_lifecycle_cases.sql) calls get_or_create_onboarding_case()
-- directly against already-existing rows, not via this INSERT trigger, so
-- there's no retroactive flood risk the way the two original Shape-B scan
-- rules had.
insert into public.notification_rules (event_type, target_departments, target_roles, target_payload_keys, channels)
values
    ('employee.onboarding_case_opened',
        array['HR'], array[]::text[], array['manager_profile_id'], array['in_app', 'email']),
    ('employee.onboarding_it_setup_needed',
        array['IT'], array[]::text[], array[]::text[], array['in_app', 'email']);
