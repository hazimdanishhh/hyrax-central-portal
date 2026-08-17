-- Run this once in the Supabase SQL editor, after
-- notify_profile_updated.sql and trg_notify_profile_updated.sql.
--
-- Targets the profile itself via target_payload_keys -- no role/department
-- targeting at all. This is purely "notify whoever this row is about",
-- not superadmin or HR (they already know, since they're the ones who
-- just made the change).
insert into public.notification_rules (
    event_type,
    target_payload_keys,
    channels
) values (
    'profile.department_role_assigned',
    array['profile_id'],
    array['in_app', 'email']
);
