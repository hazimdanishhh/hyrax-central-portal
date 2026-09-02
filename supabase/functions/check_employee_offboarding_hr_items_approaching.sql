-- arguments: none
-- returns: void
--
-- Scheduled-scan ("Shape B"), mirroring
-- check_employee_offboarding_last_day_approaching.sql exactly, but scoped
-- to HR-owned items instead of IT-owned, with its own cooldown column
-- (hr_items_reminder_last_notified_at) so it never contends with IT's.
-- Closes a real parity gap: IT already got a proactive "your items are due
-- soon" nudge; HR only ever heard about it once the case was already
-- overdue (employee.offboarding_overdue). See
-- docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's UAT readiness pass.
--
-- Seeded active immediately (see seed_offboarding_hr_items_approaching_notification_rule.sql)
-- -- unlike the original IT/overdue pair, this is a brand-new rule with no
-- pre-existing backfilled cases to flood, so no pause-then-resume dance is
-- needed.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- scan function in this system. Runs under pg_cron with no calling user
-- session.
create or replace function public.check_employee_offboarding_hr_items_approaching()
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
          and c.expected_last_day between current_date and current_date + interval '7 days'
          and exists (
              select 1 from public.employee_lifecycle_case_items i
              where i.case_id = c.id and i.owning_department_sub = 'HR'
                and i.status not in ('DONE', 'SKIPPED')
          )
          and (c.hr_items_reminder_last_notified_at is null
               or c.hr_items_reminder_last_notified_at < now() - interval '3 days')
    loop
        begin
            perform public.emit_notification_event(
                'employee.offboarding_hr_items_approaching', 'employee_lifecycle_cases', v_row.case_id::text,
                jsonb_build_object(
                    'case_id', v_row.case_id, 'employee_id', v_row.employee_id,
                    'employee_name', v_row.full_name, 'expected_last_day', v_row.expected_last_day,
                    'title', 'Offboarding: Items Due Before Last Day',
                    'message', format(
                        '%s''s last working day (%s) is approaching -- HR still has open checklist items.',
                        v_row.full_name, v_row.expected_last_day
                    ),
                    'link_to', '/app/hr/offboarding/' || v_row.case_id
                )
            );

            update public.employee_lifecycle_cases
                set hr_items_reminder_last_notified_at = now()
                where id = v_row.case_id;
        exception when others then
            raise warning 'offboarding HR-items-approaching reminder failed for case %: %', v_row.case_id, sqlerrm;
        end;
    end loop;
end;
$$;
