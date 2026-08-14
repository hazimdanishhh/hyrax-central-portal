-- arguments: p_event_type text, p_entity_table text, p_entity_id text, p_payload jsonb
-- returns: bigint (the new notification_events.id)
--
-- Entry point any trigger on any table calls to participate in the
-- notification system -- this is the whole point of the generic event log:
-- adding a notification for a table nobody's thought of yet means writing
-- ONE call to this function, not new dispatch code.
--
-- By convention (not enforced -- keeps this function fully generic),
-- p_payload should include "title" and "message" keys with human-readable
-- text -- fan_out_notification_event() uses those directly for the
-- notification/email content, falling back to the raw event_type/payload
-- if the caller omits them.
--
-- SECURITY DEFINER: the calling trigger runs with whatever privileges its
-- own session has (e.g. a sales rep updating their own lead) -- but
-- fan-out needs to write notifications for OTHER users, which normal RLS
-- would correctly refuse. Bypassing RLS here, deliberately, is what makes
-- that possible. set search_path = '' + fully-qualified names, same
-- hardening as public.is_superadmin() (see supabase/policies/
-- profiles_crud.sql for why this matters for SECURITY DEFINER functions).
create or replace function public.emit_notification_event(
    p_event_type text,
    p_entity_table text,
    p_entity_id text,
    p_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event_id bigint;
begin
    insert into public.notification_events (event_type, entity_table, entity_id, payload)
    values (p_event_type, p_entity_table, p_entity_id, p_payload)
    returning id into v_event_id;

    -- Nested block, deliberately: a bad rule or a recipient-resolution bug
    -- inside fan-out must not roll back the event row we just durably
    -- wrote above. The event log staying complete matters more than any
    -- one rule's fan-out succeeding -- and the caller (the actual trigger
    -- on the business table) wraps ITS call to this function the same way,
    -- so nothing here can ever break the underlying business transaction
    -- either. See log_sales_leads_stage_change.sql for that outer layer.
    begin
        perform public.fan_out_notification_event(v_event_id);
    exception when others then
        raise warning 'fan_out_notification_event failed for event %: %', v_event_id, sqlerrm;
    end;

    return v_event_id;
end;
$$;
