-- Run this once in the Supabase SQL editor, after
-- notification_rules_add_target_payload_keys.sql.
--
-- Seed rule for the scheduled-scan example: notify when an employee's
-- probation confirmation is due soon (see
-- supabase/functions/check_employee_confirmations_due_soon.sql). Recipients
-- are the specific employee's own manager (via target_payload_keys ->
-- manager_profile_id, resolved per-event) AND HR broadly (role/department
-- targeting, same model as the lead-stage rule) -- both channels, so
-- neither an absent manager profile nor an HR miss lets this fall through
-- silently. This row is data, not code -- editable directly (or via a
-- future rules-admin UI) with no function changes needed.
insert into public.notification_rules (
    event_type,
    target_roles,
    target_departments,
    target_payload_keys,
    channels
) values (
    'employee.confirmation_due_soon',
    array['manager', 'staff'],
    array['HR'],
    array['manager_profile_id'],
    array['in_app', 'email']
);
