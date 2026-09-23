-- Rules for the payroll reconciliation notifications. BOTH in_app only for now
-- (email deferred, see docs/PAYROLL-DATA-REQUIREMENTS.md's "Planned:
-- automated email" appendix).
--
-- SAFE TO RE-RUN as of 2026-09-23. This file was a bare INSERT, so running it
-- a second time silently created DUPLICATE rules -- and a duplicate rule means
-- fan_out_notification_event emits a duplicate notification to everyone it
-- matches, for every event, forever. The delete below makes it idempotent.
--
-- If you have run this file more than once already, the delete fixes it: it
-- clears every copy before reinserting exactly one of each.
delete from public.notification_rules
where event_type in (
    'payroll.reconciliation_outstanding',
    'payroll.reconciliation_digest_weekly'
);
--
-- payroll.reconciliation_outstanding: no target_roles/target_departments --
-- its only intended recipient is the employee each notification is about,
-- via target_payload_keys.
insert into public.notification_rules (event_type, target_payload_keys, channels)
values
    ('payroll.reconciliation_outstanding', array['employee_profile_id'], array['in_app']);

-- TWO rules, not one (fixed 2026-09-23).
--
-- This was a single rule with target_departments => array['HR'] AND
-- target_roles => array['superadmin'], which reads like "HR, plus superadmin"
-- but does not behave that way. fan_out_notification_event.sql ANDs the two
-- when both are set, so it resolved to "profiles in the HR department whose
-- role is superadmin" -- almost certainly nobody, since a superadmin sits in
-- IT or MGM rather than HR. The weekly digest was very likely reaching no one
-- at all, silently, since a rule matching zero recipients raises nothing.
--
-- Expressing it as two rules is how an OR is written here: fan-out evaluates
-- every active rule for the event type, so the recipient sets add together.
insert into public.notification_rules (event_type, target_departments, target_roles, channels)
values
    -- The HR department itself -- manager and staff, the people who actually
    -- run the reconciliation.
    ('payroll.reconciliation_digest_weekly', array['HR'], array['manager', 'staff'], array['in_app']),
    -- Superadmin, regardless of department. Department left empty so it is
    -- not ANDed away.
    ('payroll.reconciliation_digest_weekly', array[]::text[], array['superadmin'], array['in_app']);
