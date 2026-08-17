-- Run this once in the Supabase SQL editor, after
-- notify_profile_created.sql and trg_notify_profile_created.sql.
--
-- Targets the new profile itself via target_payload_keys -- the same
-- generic mechanism already built for manager_profile_id, reused here for
-- "notify whoever this event is about" with no engine changes needed.
insert into public.notification_rules (
    event_type,
    target_payload_keys,
    channels
) values (
    'profile.created.welcome',
    array['new_profile_id'],
    array['in_app', 'email']
);
