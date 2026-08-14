-- Run this once in the Supabase SQL editor, after
-- check_attendance_approvals_pending.sql.
--
-- Recipients deliberately mirror approve_attendance.sql/reject_attendance.sql's
-- own authorization model: the employee's own manager (via
-- target_payload_keys -> manager_profile_id) AND HR broadly. Superadmin is
-- also authorized to approve/reject but isn't targeted here, same as every
-- other rule in this system -- superadmin is a "break glass" catch-all, not
-- a routine approver expected to act on every pending item company-wide.
insert into public.notification_rules (
    event_type,
    target_roles,
    target_departments,
    target_payload_keys,
    channels
) values (
    'attendance.approval_pending',
    array['manager', 'staff'],
    array['HR'],
    array['manager_profile_id'],
    array['in_app', 'email']
);
