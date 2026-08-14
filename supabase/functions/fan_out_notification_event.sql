-- arguments: p_event_id bigint
-- returns: void
--
-- Matches an event against active notification_rules for its event_type,
-- resolves recipients, and writes one notifications row per in_app
-- recipient and one email_queue row per email recipient. Called by
-- emit_notification_event() -- not meant to be called directly, though
-- nothing stops a superadmin from re-running it manually against an old
-- event_id for debugging.
--
-- SECURITY DEFINER for the same reason as emit_notification_event.sql --
-- writing another user's notifications row must bypass their own RLS
-- (which correctly only lets a user read/update their OWN rows).
create or replace function public.fan_out_notification_event(p_event_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_event record;
    v_rule record;
    v_recipient record;
    v_condition_key text;
    v_condition_matches boolean;
    -- Plain constant, not a secret/env var -- matches this codebase's
    -- existing precedent of hardcoding the Supabase project URL directly in
    -- schedule_send_queued_emails_cron.sql. Only revisit if this app is ever
    -- deployed under more than one domain.
    v_app_base_url constant text := 'https://portal.hyraxoil.com';
begin
    select * into v_event from public.notification_events where id = p_event_id;
    if v_event is null then
        return;
    end if;

    for v_rule in
        select * from public.notification_rules
        where event_type = v_event.event_type and is_active
    loop
        -- Each rule processed in its own block: one malformed rule (e.g. a
        -- condition value that isn't actually a JSON array) must not stop
        -- OTHER valid rules for this same event from firing.
        begin
            -- Match `condition` against the event payload -- AND semantics
            -- across keys: every key in condition must match. An empty
            -- condition ('{}') always matches.
            v_condition_matches := true;
            for v_condition_key in select jsonb_object_keys(v_rule.condition)
            loop
                if not (
                    v_event.payload ->> v_condition_key = any (
                        select jsonb_array_elements_text(v_rule.condition -> v_condition_key)
                    )
                ) then
                    v_condition_matches := false;
                    exit;
                end if;
            end loop;

            if not v_condition_matches then
                continue;
            end if;

            -- Recipients: role/department match (same targeting model as
            -- canAccess({roles,departments}) in AccessControlContext.jsx)
            -- UNION an explicit list of profile ids ("target_employee_ids"
            -- for how admins will think about it, but it stores
            -- profiles.id -- the same uuid as auth.uid() and
            -- employees.profile_id) UNION whoever a payload key points at
            -- (target_payload_keys -- for events that need to notify a
            -- specific person the event is ABOUT, e.g. an employee's own
            -- manager, not just a static role/department). The payload
            -- value is validated as a uuid via regex before casting, rather
            -- than relying on the per-rule exception block above to catch a
            -- bad cast -- that block guards the whole rule, not just one
            -- malformed recipient. email_work is the deliverable address,
            -- per this team's existing convention -- profiles.email is the
            -- Auth login address, not curated as an org-facing one. Falls
            -- back to profiles.email only if no employees row (or no
            -- email_work) exists, so email still has a shot rather than
            -- silently having nowhere to go.
            for v_recipient in
                select distinct p.id as profile_id,
                       coalesce(e.email_work, p.email) as email
                from public.profiles p
                left join public.employees e on e.profile_id = p.id
                left join public.roles r on r.id = p.role_id
                left join public.departments d on d.id = p.department_id
                where
                    (
                        array_length(v_rule.target_roles, 1) is not null
                        and r.name = any (v_rule.target_roles)
                        and (
                            array_length(v_rule.target_departments, 1) is null
                            or d.sub = any (v_rule.target_departments)
                        )
                    )
                    or p.id = any (v_rule.target_employee_ids)
                    or p.id = any (
                        select (v_event.payload ->> key)::uuid
                        from unnest(v_rule.target_payload_keys) as key
                        where v_event.payload ->> key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    )
            loop
                if 'in_app' = any (v_rule.channels) then
                    insert into public.notifications (user_id, type, title, message, link_to, created_by)
                    values (
                        v_recipient.profile_id,
                        coalesce(v_event.payload ->> 'notification_type', 'info'),
                        coalesce(v_event.payload ->> 'title', v_event.event_type),
                        coalesce(v_event.payload ->> 'message', v_event.payload::text),
                        v_event.payload ->> 'link_to',
                        'system'
                    );
                end if;

                -- Every email gets a clickable link back to the same place
                -- the in-app notification points at (link_to), whenever the
                -- payload sets one -- so anyone notified by email only, or
                -- who reads the email before the app, can jump straight
                -- there instead of hunting for it themselves.
                if 'email' = any (v_rule.channels) and v_recipient.email is not null then
                    insert into public.email_queue (to_email, subject, body_html, related_event_id)
                    values (
                        v_recipient.email,
                        coalesce(v_event.payload ->> 'title', v_event.event_type),
                        coalesce(v_event.payload ->> 'message', v_event.payload::text)
                            || case
                                 when v_event.payload ->> 'link_to' is not null
                                 then format(
                                     '<p><a href="%s%s">View in Hyrax Central Portal</a></p>',
                                     v_app_base_url, v_event.payload ->> 'link_to'
                                 )
                                 else ''
                               end,
                        v_event.id
                    );
                end if;
            end loop;
        exception when others then
            raise warning 'notification_rules row % failed to fan out for event %: %',
                v_rule.id, p_event_id, sqlerrm;
        end;
    end loop;
end;
$$;
