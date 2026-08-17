-- Run this once in the Supabase SQL editor, after
-- notify_profile_created.sql and trg_notify_profile_created.sql.
--
-- HR only -- they have the organizational context to know who's who,
-- unlike superadmin. Data, not code -- edit target_departments directly
-- later if this should change.
insert into public.notification_rules (
    event_type,
    target_departments,
    channels
) values (
    'profile.created.needs_employee_link',
    array['HR'],
    array['in_app', 'email']
);
