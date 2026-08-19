-- Run this once in the Supabase SQL editor, after
-- notification_rules_add_target_payload_keys.sql and
-- trg_notify_sales_order_po_matched.sql.
--
-- Single recipient (the lead owner the trigger already resolved), same
-- shape as document.attached/project.status_changed/task.status_changed's
-- seed rows: condition stays empty (the trigger itself only ever emits
-- this event when a match was found), target_payload_keys picks up the
-- one profile id the trigger put in the payload.
insert into public.notification_rules (
    event_type, condition, target_payload_keys, channels
) values (
    'sales_order.po_matched', '{}'::jsonb, array['lead_owner_profile_id'], array['in_app', 'email']
);
