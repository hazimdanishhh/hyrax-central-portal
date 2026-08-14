-- Run this once in the Supabase SQL editor, after
-- check_employee_confirmations_overdue.sql.
--
-- Same recipients as the confirmation-due-soon rule: the specific
-- employee's own manager (via target_payload_keys -> manager_profile_id)
-- AND HR broadly -- this is data, not code, editable directly with no
-- function changes needed.
insert into public.notification_rules (
    event_type,
    target_roles,
    target_departments,
    target_payload_keys,
    channels
) values (
    'employee.confirmation_overdue',
    array['manager', 'staff'],
    array['HR'],
    array['manager_profile_id'],
    array['in_app', 'email']
);
