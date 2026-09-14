-- Two rules, BOTH in_app only for now (email deferred, see
-- docs/PAYROLL-DATA-REQUIREMENTS.md's "Planned: automated email" appendix).
--
-- payroll.reconciliation_outstanding: no target_roles/target_departments --
-- its only intended recipient is the employee each notification is about,
-- via target_payload_keys.
insert into public.notification_rules (event_type, target_payload_keys, channels)
values
    ('payroll.reconciliation_outstanding', array['employee_profile_id'], array['in_app']);

insert into public.notification_rules (event_type, target_departments, target_roles, channels)
values
    ('payroll.reconciliation_digest_weekly', array['HR'], array['superadmin'], array['in_app']);
