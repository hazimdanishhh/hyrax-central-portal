-- ############################################################################
-- EXPORT: notification_rules -> docs/portal/NOTIFICATION-RULES.csv
--
-- Read-only. Run in the Supabase SQL editor and export the result as CSV,
-- the same way docs/portal/TABLE-POLICIES.csv is maintained.
--
-- Re-run this after ANY change to a notification rule or to the functions that
-- emit events. The rules table is the only place that decides who receives
-- what, and nothing in the app surfaces it -- so a checked-in snapshot is the
-- only way to review the blast radius of a notification without reading SQL.
-- ############################################################################

select
    r.event_type,

    -- WHO RECEIVES IT, in words. fan_out_notification_event() resolves
    -- recipients as:
    --     (roles AND departments)  OR  target_employee_ids  OR  payload keys
    -- Note the AND inside the first group: a rule with BOTH target_roles and
    -- target_departments set matches only people satisfying both. That is not
    -- obvious from the columns, and it has already caused one live bug --
    -- 'HR' + 'superadmin' resolved to "HR people who are superadmins", i.e.
    -- nobody, and the digest silently reached no one for weeks.
    case
        when coalesce(array_length(r.target_roles, 1), 0) > 0
         and coalesce(array_length(r.target_departments, 1), 0) > 0
            then format('%s in %s',
                        array_to_string(r.target_roles, '/'),
                        array_to_string(r.target_departments, '/'))
        when coalesce(array_length(r.target_departments, 1), 0) > 0
            then format('anyone in %s', array_to_string(r.target_departments, '/'))
        when coalesce(array_length(r.target_roles, 1), 0) > 0
            then format('any %s', array_to_string(r.target_roles, '/'))
        else ''
    end as audience_by_role_dept,

    -- Recipients named by a uuid carried in the event payload -- this is how a
    -- notification reaches ONE specific person (the employee it is about, or
    -- their manager) rather than a group.
    array_to_string(r.target_payload_keys, ', ') as audience_by_payload_key,

    array_to_string(r.target_employee_ids::text[], ', ') as audience_explicit_ids,

    array_to_string(r.channels, ', ') as channels,
    r.condition::text                 as condition,
    r.is_active,

    -- DUPLICATE DETECTION. Every rule matching an event contributes its own
    -- recipient set, so two identical rows send the notification twice to
    -- everyone. Several seed files were bare INSERTs and silently accumulated
    -- copies on each re-run; they now delete before inserting, but this column
    -- is the standing check.
    --
    -- A count above 1 is NOT automatically wrong: payroll.reconciliation_
    -- digest_weekly is deliberately two rules, because two rules is how an OR
    -- between audiences is expressed here. Compare the audience columns --
    -- different audiences are intentional, identical ones are a duplicate.
    count(*) over (partition by r.event_type) as rules_for_this_event,

    r.id,
    r.created_at,
    r.updated_at
from public.notification_rules r
order by r.event_type, r.id;


-- ############################################################################
-- COMPANION CHECKS -- run separately, not part of the export
-- ############################################################################

-- 1. Genuine duplicates: same event, same audience, same channels. Expect
--    ZERO rows. Anything here is double-sending right now.
-- select event_type, target_roles, target_departments, target_payload_keys,
--        channels, count(*) as copies
-- from public.notification_rules
-- group by 1,2,3,4,5
-- having count(*) > 1;

-- 2. Rules that can never match anyone -- no roles, no departments, no
--    payload keys, no explicit ids. These fire into nothing, silently.
-- select id, event_type
-- from public.notification_rules
-- where coalesce(array_length(target_roles, 1), 0) = 0
--   and coalesce(array_length(target_departments, 1), 0) = 0
--   and coalesce(array_length(target_payload_keys, 1), 0) = 0
--   and coalesce(array_length(target_employee_ids, 1), 0) = 0;

-- 3. Event types EMITTED in the last 90 days that have no active rule -- the
--    inverse failure, where a function does work and nobody is told.
-- select distinct ne.event_type
-- from public.notification_events ne
-- where ne.created_at > now() - interval '90 days'
--   and not exists (
--       select 1 from public.notification_rules r
--       where r.event_type = ne.event_type and r.is_active
--   );

-- 4. Active rules whose event type has NOT been emitted in 90 days -- likely
--    dead routes left behind by a renamed or removed emitter.
-- select r.event_type, r.id
-- from public.notification_rules r
-- where r.is_active
--   and not exists (
--       select 1 from public.notification_events ne
--       where ne.event_type = r.event_type
--         and ne.created_at > now() - interval '90 days'
--   );
