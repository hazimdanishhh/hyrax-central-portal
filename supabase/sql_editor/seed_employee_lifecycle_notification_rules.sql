-- Run this once in the Supabase SQL editor, after every function/trigger
-- file for this module has been deployed. Six rules, matching the six
-- Proposed rows already logged in docs/NOTIFICATION-RULES-TRACKER.csv.
-- Data, not code -- edit target_departments/target_roles directly later if
-- recipients should change, no function/trigger edits needed.
insert into public.notification_rules (event_type, target_departments, target_roles, target_payload_keys, channels)
values
    ('employee.offboarding_case_opened',
        array['HR'], array[]::text[], array['manager_profile_id'], array['in_app', 'email']),
    ('employee.offboarding_it_revocation_needed',
        array['IT'], array[]::text[], array[]::text[], array['in_app', 'email']),
    ('employee.onboarding_checklist_completed',
        array['HR'], array[]::text[], array['new_profile_id'], array['in_app', 'email']),
    ('employee.offboarding_case_completed',
        array['HR'], array['superadmin'], array[]::text[], array['in_app', 'email']),
    ('employee.offboarding_last_day_approaching',
        array['IT'], array[]::text[], array[]::text[], array['in_app', 'email']),
    ('employee.offboarding_overdue',
        array['HR', 'IT'], array['superadmin'], array[]::text[], array['in_app', 'email']);
