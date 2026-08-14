-- arguments: none
-- returns: void
--
-- Scheduled-scan escalation counterpart to check_employee_confirmations_due_soon.sql
-- -- once the confirmation_due_date actually passes and the employee still
-- isn't confirmed, this takes over. Condition copied verbatim from
-- get_hr_employees_dashboard_rpc.sql's late_confirmations_count KPI
-- (Probation status, confirmation_date still null, confirmation_due_date
-- already in the past) so this and that dashboard tile can never disagree.
--
-- Unlike the due-soon reminder, this is a RECURRING reminder, not a
-- one-shot: an overdue confirmation is an ongoing, unresolved backlog
-- state, worth re-nagging about periodically until fixed.
-- confirmation_overdue_last_notified_at is a cooldown timestamp, not a
-- boolean dedup flag -- re-notifies every 7 days (adjustable) until the
-- employee is actually confirmed or moves off Probation.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this system.
create or replace function public.check_employee_confirmations_overdue()
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
            (e.join_date + interval '6 months')::date as confirmation_due_date,
            m.profile_id as manager_profile_id
        from public.employees e
        left join public.employees m on m.id = e.manager_id
        left join public.employment_status es on es.id = e.employment_status_id
        where es.name = 'Probation'
          and e.confirmation_date is null
          and (e.join_date + interval '6 months')::date < current_date
          and (e.confirmation_overdue_last_notified_at is null
               or e.confirmation_overdue_last_notified_at < now() - interval '7 days')
    loop
        begin
            perform public.emit_notification_event(
                'employee.confirmation_overdue', 'employees', v_row.id::text,
                jsonb_build_object(
                    'employee_id', v_row.id,
                    'employee_name', v_row.full_name,
                    'confirmation_due_date', v_row.confirmation_due_date,
                    'manager_profile_id', v_row.manager_profile_id,
                    'title', 'Confirmation Overdue',
                    'message', format(
                        '%s''s probation confirmation was due on %s and is now overdue.',
                        v_row.full_name, v_row.confirmation_due_date
                    ),
                    'link_to', '/app/employees/' || v_row.id
                )
            );

            update public.employees
                set confirmation_overdue_last_notified_at = now()
                where id = v_row.id;
        exception when others then
            raise warning 'confirmation overdue reminder failed for employee %: %', v_row.id, sqlerrm;
        end;
    end loop;
end;
$$;
