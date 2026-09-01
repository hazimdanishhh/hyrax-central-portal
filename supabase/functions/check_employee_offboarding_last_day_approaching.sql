-- arguments: none
-- returns: void
--
-- Scheduled-scan ("Shape B") -- expected_last_day doesn't change as the
-- deadline approaches, so there's no row-change trigger to hook into, same
-- reasoning as check_employee_confirmations_due_soon.sql. Scans OPEN
-- offboarding cases whose expected_last_day is within 7 days and still
-- have at least one IT-owned item not DONE/SKIPPED, with a 3-day cooldown
-- (it_revocation_reminder_last_notified_at) so IT isn't re-nagged daily for
-- the whole window.
--
-- The 7-day window and 3-day cooldown are reasonable strawmen, not
-- confirmed business decisions -- flagged as TBD in
-- docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md, matching
-- NOTIFICATION-RULES-TRACKER.csv's own convention for unresolved
-- thresholds elsewhere. Seeded paused (is_active = false) at deploy time --
-- see pause_employee_offboarding_scan_rules.sql -- since real employees may
-- already be mid-notice-period once the backfill runs.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- scan function in this system. Runs under pg_cron with no calling user
-- session.
create or replace function public.check_employee_offboarding_last_day_approaching()
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
              where i.case_id = c.id and i.owning_department_sub = 'IT'
                and i.status not in ('DONE', 'SKIPPED')
          )
          and (c.it_revocation_reminder_last_notified_at is null
               or c.it_revocation_reminder_last_notified_at < now() - interval '3 days')
    loop
        begin
            perform public.emit_notification_event(
                'employee.offboarding_last_day_approaching', 'employee_lifecycle_cases', v_row.case_id::text,
                jsonb_build_object(
                    'case_id', v_row.case_id, 'employee_id', v_row.employee_id,
                    'employee_name', v_row.full_name, 'expected_last_day', v_row.expected_last_day,
                    'title', 'Offboarding: Last Day Approaching',
                    'message', format(
                        '%s''s last working day (%s) is approaching -- IT access is not yet fully revoked.',
                        v_row.full_name, v_row.expected_last_day
                    ),
                    'link_to', '/app/it/offboarding/' || v_row.case_id
                )
            );

            update public.employee_lifecycle_cases
                set it_revocation_reminder_last_notified_at = now()
                where id = v_row.case_id;
        exception when others then
            raise warning 'offboarding last-day-approaching reminder failed for case %: %', v_row.case_id, sqlerrm;
        end;
    end loop;
end;
$$;
