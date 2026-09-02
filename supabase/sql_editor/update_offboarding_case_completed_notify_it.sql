-- Run this once in the Supabase SQL editor, any time after
-- seed_employee_lifecycle_notification_rules.sql.
--
-- A one-time correction, not an edit to the already-run seed file (seed
-- INSERTs aren't safely re-runnable -- same convention as
-- pause_employee_offboarding_scan_rules.sql). IT owns several of the
-- offboarding checklist's items (it_assets_returned, software_access_revoked,
-- workspace_account_revoked, credentials_rotated, portal_account_deactivated)
-- but previously had no closing confirmation when the case they worked on
-- actually completed -- only HR/superadmin did. Adds IT as a co-recipient.
update public.notification_rules
set target_departments = array['HR', 'IT']
where event_type = 'employee.offboarding_case_completed';
