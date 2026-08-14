-- arguments: none
-- returns: void
--
-- Scheduled-scan for a data-hygiene anomaly: an employee who was moved OFF
-- Probation status (e.g. to Active) without ever actually being confirmed,
-- and whose original confirmation_due_date has already passed. Condition
-- copied verbatim from get_hr_employees_dashboard_rpc.sql's
-- status_mismatch_count KPI -- deliberately mutually exclusive from
-- check_employee_confirmations_overdue.sql's own condition ('Probation' vs
-- <> 'Probation'), so an employee is only ever a candidate for one of the
-- two, never both.
--
-- One-shot, not a recurring cooldown (unlike the overdue-confirmation
-- reminder) -- this is a rare anomaly for HR to investigate once, not an
-- expected ongoing queue. Recipients are HR only, not the employee's
-- manager -- this is HR's own data-entry/process gap, not something to
-- hand to a line manager.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this system.
create or replace function public.check_employee_confirmation_status_mismatches()
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
            es.name as employment_status_name
        from public.employees e
        left join public.employment_status es on es.id = e.employment_status_id
        where es.category = 'active'
          and es.name <> 'Probation'
          and e.confirmation_date is null
          and (e.join_date + interval '6 months')::date < current_date
          and e.confirmation_mismatch_notified_at is null
    loop
        begin
            perform public.emit_notification_event(
                'employee.confirmation_status_mismatch', 'employees', v_row.id::text,
                jsonb_build_object(
                    'employee_id', v_row.id,
                    'employee_name', v_row.full_name,
                    'confirmation_due_date', v_row.confirmation_due_date,
                    'employment_status_name', v_row.employment_status_name,
                    'title', 'Confirmation Status Mismatch',
                    'message', format(
                        '%s was moved to %s status but was never confirmed, and their original confirmation due date (%s) has already passed -- this may be a data-entry gap worth reviewing.',
                        v_row.full_name, v_row.employment_status_name, v_row.confirmation_due_date
                    ),
                    'link_to', '/app/employees/' || v_row.id
                )
            );

            update public.employees
                set confirmation_mismatch_notified_at = now()
                where id = v_row.id;
        exception when others then
            raise warning 'confirmation status mismatch check failed for employee %: %', v_row.id, sqlerrm;
        end;
    end loop;
end;
$$;
