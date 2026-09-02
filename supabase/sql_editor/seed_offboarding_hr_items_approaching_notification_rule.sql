-- Run this once in the Supabase SQL editor, after
-- check_employee_offboarding_hr_items_approaching.sql has been created.
--
-- One rule, seeded active immediately -- unlike
-- seed_employee_lifecycle_notification_rules.sql's two scan-driven rules,
-- there's no pre-existing backfill to flood here, so no pause file is
-- needed alongside this one.
insert into public.notification_rules (event_type, target_departments, target_roles, target_payload_keys, channels)
values
    ('employee.offboarding_hr_items_approaching',
        array['HR'], array[]::text[], array[]::text[], array['in_app', 'email']);
