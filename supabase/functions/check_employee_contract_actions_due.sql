-- arguments: none
-- returns: void
--
-- Scheduled-scan for contract-type employment approaching its end_date.
-- Condition copied verbatim from get_hr_employees_dashboard_rpc.sql's
-- contract_actions_due_count KPI, INCLUDING that RPC's own disclosed
-- caveat: `employment_type.name ilike '%contract%'` is an ASSUMPTION, not a
-- verified match against real employment_type rows (the actual lookup
-- values aren't hardcoded anywhere in the app to confirm against) -- carried
-- forward here rather than silently trusted. Confirm this matches your live
-- employment_type rows (e.g. "Contract", "Fixed-Term Contract") before
-- relying on this in production.
--
-- One-shot, same shape as check_employee_confirmations_due_soon.sql -- a
-- contract-due window resolves the same way (renewed, ended, or the date
-- passes), it isn't an ongoing queue to re-nag about.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this system.
create or replace function public.check_employee_contract_actions_due()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row record;
begin
    for v_row in
        select
            e.id,
            e.full_name,
            e.end_date,
            m.profile_id as manager_profile_id
        from public.employees e
        left join public.employees m on m.id = e.manager_id
        left join public.employment_status es on es.id = e.employment_status_id
        left join public.employment_type et on et.id = e.employment_type_id
        where es.category = 'active'
          and et.name ilike '%contract%'
          and e.end_date is not null
          and e.end_date between current_date and current_date + interval '30 days'
          and e.contract_action_reminder_sent_at is null
    loop
        begin
            perform public.emit_notification_event(
                'employee.contract_action_due', 'employees', v_row.id::text,
                jsonb_build_object(
                    'employee_id', v_row.id,
                    'employee_name', v_row.full_name,
                    'end_date', v_row.end_date,
                    'manager_profile_id', v_row.manager_profile_id,
                    'title', 'Contract Action Due Soon',
                    'message', format(
                        '%s''s contract-type employment ends on %s -- a renewal or offboarding decision is needed soon.',
                        v_row.full_name, v_row.end_date
                    ),
                    'link_to', '/app/employees/' || v_row.id
                )
            );

            update public.employees
                set contract_action_reminder_sent_at = now()
                where id = v_row.id;
        exception when others then
            raise warning 'contract action reminder failed for employee %: %', v_row.id, sqlerrm;
        end;
    end loop;
end;
$$;
