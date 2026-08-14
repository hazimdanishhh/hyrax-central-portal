-- Run this once in the Supabase SQL editor, after
-- notifications_schema_migration.sql.
--
-- Seed rule for the concrete example: notify on Proposal->Negotiation and
-- Negotiation->Won. Recipients are a PLACEHOLDER (Sales managers, via the
-- same role/department targeting canAccess({roles,departments}) already
-- uses elsewhere) -- "sales admin" isn't a real role today (only
-- staff/manager/superadmin exist) and wasn't decided at design time. This
-- row is data, not code -- edit target_roles/target_departments/
-- target_employee_ids directly (or via a future rules-admin UI) whenever
-- the real answer is known, with no trigger/function changes needed.
insert into public.notification_rules (
    event_type,
    condition,
    target_roles,
    target_departments,
    target_employee_ids,
    channels
) values (
    'lead.stage_changed',
    jsonb_build_object('new_stage', jsonb_build_array('NEGOTIATION', 'WON')),
    array['manager'],
    array['SAL'],
    array[]::uuid[],
    array['in_app', 'email']
);
