-- Run this once in the Supabase SQL editor, after
-- notify_profile_created.sql and trg_notify_profile_created.sql.
--
-- Superadmin only -- the only role that can actually change role_id/
-- department_id (per Users.jsx's own gate). Data, not code -- edit
-- target_roles/target_employee_ids directly later if this should change.
insert into public.notification_rules (
    event_type,
    target_roles,
    channels
) values (
    'profile.created.needs_department_assignment',
    array['superadmin'],
    array['in_app', 'email']
);
