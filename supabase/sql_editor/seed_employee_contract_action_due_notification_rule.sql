-- Run this once in the Supabase SQL editor, after
-- check_employee_contract_actions_due.sql.
--
-- Same recipient shape as the confirmation reminders: the specific
-- employee's own manager (via target_payload_keys -> manager_profile_id)
-- AND HR broadly -- both have a real stake in a contract renewal/
-- offboarding decision.
insert into public.notification_rules (
    event_type,
    target_roles,
    target_departments,
    target_payload_keys,
    channels
) values (
    'employee.contract_action_due',
    array['manager', 'staff'],
    array['HR'],
    array['manager_profile_id'],
    array['in_app', 'email']
);
