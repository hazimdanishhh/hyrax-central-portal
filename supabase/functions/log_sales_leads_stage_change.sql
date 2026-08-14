-- arguments: none
-- returns: trigger
create or replace function public.log_sales_leads_stage_change()
returns trigger
language plpgsql
as $$
begin
    -- Only log if the stage actually changed, or if it's a brand new lead being inserted
    if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and old.stage is distinct from new.stage) then
        insert into public.sales_leads_stage_history (
            lead_id,
            previous_stage,
            new_stage,
            expected_revenue,
            close_probability
        ) values (
            new.id,
            case when TG_OP = 'UPDATE' then old.stage else null end,
            new.stage,
            new.expected_revenue,
            new.close_probability
        );

        -- Emit a notification event on a real stage change (not on brand
        -- new leads -- nobody needs notifying that a lead was just
        -- created at DISCOVERY). notification_rules decides which stage
        -- transitions actually notify anyone and who -- this trigger just
        -- reports what happened, generically, same as any other table's
        -- trigger would. Wrapped so a notification-system problem can
        -- NEVER roll back the lead update itself -- same "never block the
        -- primary operation" convention as hyrax-data-platform's Discord
        -- alerting and pipeline_run_log.
        if TG_OP = 'UPDATE' then
            begin
                perform public.emit_notification_event(
                    'lead.stage_changed',
                    'sales_leads',
                    new.id::text,
                    jsonb_build_object(
                        'old_stage', old.stage,
                        'new_stage', new.stage,
                        'lead_id', new.id,
                        'lead_title', new.title,
                        'lead_owner_id', new.lead_owner_id,
                        'title', 'Lead Stage Changed',
                        'message', format(
                            'Lead "%s" moved from %s to %s.',
                            new.title, old.stage, new.stage
                        ),
                        'link_to', '/app/sales/leads/list/' || new.id
                    )
                );
            exception when others then
                raise warning 'emit_notification_event failed for lead % stage change: %',
                    new.id, sqlerrm;
            end;
        end if;
    end if;
    return new;
end;
$$;