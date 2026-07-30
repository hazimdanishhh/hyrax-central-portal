-- arguments: none
-- returns: trigger

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
    end if;
    return new;
end;
