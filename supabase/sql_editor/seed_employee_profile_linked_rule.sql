-- Run this once in the Supabase SQL editor, after
-- notify_employee_profile_linked.sql and trg_notify_employee_profile_linked.sql.
--
-- Targets the newly-linked profile via target_payload_keys -- not HR or
-- superadmin (they already know, since they're the ones who just linked it).
insert into public.notification_rules (
    event_type,
    target_payload_keys,
    channels
) values (
    'employee.profile_linked',
    array['linked_profile_id'],
    array['in_app', 'email']
);
