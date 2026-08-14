-- Run this once in the Supabase SQL editor, after
-- notifications_schema_migration.sql.
--
-- Generic extension to the recipient-targeting model: target_roles/
-- target_departments/target_employee_ids are all static, decided when the
-- rule row is written. Some events need to notify whoever is referenced BY
-- THE EVENT ITSELF (e.g. "this specific employee's manager") -- there was no
-- way to express that until now. target_payload_keys lists payload keys
-- whose value (a profiles.id uuid) should also be treated as a recipient --
-- fan_out_notification_event() resolves these alongside role/department/
-- explicit-list, not instead of them. Default '{}' means every existing
-- rule (lead.stage_changed) is completely unaffected.
alter table public.notification_rules
    add column if not exists target_payload_keys text[] not null default '{}';
