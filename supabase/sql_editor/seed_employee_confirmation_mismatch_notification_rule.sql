-- Run this once in the Supabase SQL editor, after
-- check_employee_confirmation_status_mismatches.sql.
--
-- HR only, deliberately -- no target_payload_keys here. This is an
-- HR-internal data-entry/process gap (someone moved off Probation without
-- ever being confirmed), not something to hand to the employee's manager.
insert into public.notification_rules (
    event_type,
    target_roles,
    target_departments,
    channels
) values (
    'employee.confirmation_status_mismatch',
    array['manager', 'staff'],
    array['HR'],
    array['in_app', 'email']
);
