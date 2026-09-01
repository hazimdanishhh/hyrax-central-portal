-- arguments: none
-- returns: void
--
-- Scheduled-scan escalation counterpart to
-- check_employee_offboarding_last_day_approaching.sql -- once
-- expected_last_day actually passes and the case is still OPEN, this takes
-- over. Recurring reminder (not one-shot), 7-day cooldown
-- (overdue_last_notified_at), mirroring check_employee_confirmations_overdue.sql's
-- shape exactly -- an overdue offboarding is an ongoing, unresolved
-- backlog state worth re-nagging about until fixed.
--
-- Seeded paused (is_active = false) at deploy time -- see
-- pause_employee_offboarding_scan_rules.sql.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- scan function in this system.
create or replace function public.check_employee_offboarding_overdue()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row record;
begin
    for v_row in
        select c.id as case_id, e.id as employee_id, e.full_name, c.expected_last_day
        from public.employee_lifecycle_cases c
        join public.employees e on e.id = c.employee_id
        where c.case_type = 'OFFBOARDING'
          and c.status = 'OPEN'
          and c.expected_last_day < current_date
          and (c.overdue_last_notified_at is null
               or c.overdue_last_notified_at < now() - interval '7 days')
    loop
        begin
            perform public.emit_notification_event(
                'employee.offboarding_overdue', 'employee_lifecycle_cases', v_row.case_id::text,
                jsonb_build_object(
                    'case_id', v_row.case_id, 'employee_id', v_row.employee_id,
                    'employee_name', v_row.full_name, 'expected_last_day', v_row.expected_last_day,
                    'title', 'Offboarding Overdue',
                    'message', format(
                        '%s''s offboarding was expected to complete by %s and is still open.',
                        v_row.full_name, v_row.expected_last_day
                    ),
                    'link_to', '/app/hr/offboarding/' || v_row.case_id
                )
            );

            update public.employee_lifecycle_cases
                set overdue_last_notified_at = now()
                where id = v_row.case_id;
        exception when others then
            raise warning 'offboarding overdue reminder failed for case %: %', v_row.case_id, sqlerrm;
        end;
    end loop;
end;
$$;
