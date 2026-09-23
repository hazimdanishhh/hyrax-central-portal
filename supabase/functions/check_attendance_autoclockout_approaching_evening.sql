-- arguments: none
-- returns: void
--
-- Scheduled-scan reminder, ~15 minutes before the real evening auto-clock-out
-- cutoff (auto_clock_out(), see supabase/functions/auto_clock_out.sql --
-- already scheduled around 5:00 PM MYT). Warns anyone with a still-open
-- remote attendance_activities row that they're about to be force-clocked-out.
--
-- One-shot per row via evening_autoclockout_warned_at (see
-- attendance_activities_add_autoclockout_warning_columns.sql), not a
-- recurring cooldown like attendance.approval_pending's -- the paired real
-- cutoff closes the row minutes later, so there's nothing to re-nag about.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this system.
create or replace function public.check_attendance_autoclockout_approaching_evening()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row record;
begin
    -- ONE PER EMPLOYEE, not one per open session (consolidated 2026-09-23).
    --
    -- This looped over open activity rows, so an employee with two sessions
    -- still running got two warnings at the same minute, saying the same
    -- thing, about the same deadline. The action is identical either way --
    -- go and close them -- so the count belongs in the message, not in the
    -- number of notifications.
    --
    -- The cooldown is still stamped PER ROW below, the same way
    -- check_tasks_due_soon.sql does it: the marker column exists to stop a
    -- given SESSION being warned about twice, and consolidating the
    -- notification must not weaken that.
    for v_row in
        select e.id            as employee_id,
               e.profile_id    as employee_profile_id,
               count(*)        as open_count
        from public.attendance_activities aa
        join public.employees e on e.id = aa.employee_id
        where aa.clocked_out_at is null
          and aa.evening_autoclockout_warned_at is null
          and e.profile_id is not null
        group by e.id, e.profile_id
    loop
        begin
            perform public.emit_notification_event(
                'attendance.autoclockout_approaching', 'employees', v_row.employee_id::text,
                jsonb_build_object(
                    'employee_id', v_row.employee_id,
                    'employee_profile_id', v_row.employee_profile_id,
                    'open_count', v_row.open_count,
                    'notification_type', 'warning',
                    'title', 'You Will Be Automatically Clocked Out Soon',
                    'message', format(
                        'You are still clocked in for %s remote work session%s. %s be automatically clocked out around 5:00 PM MYT unless you clock out first. If you are still working after that, clock in again.',
                        v_row.open_count,
                        case when v_row.open_count = 1 then '' else 's' end,
                        case when v_row.open_count = 1 then 'It will' else 'They will' end
                    ),
                    'link_to', '/app/employee/attendance/list'
                )
            );

            -- Stamp every session this notification covered.
            update public.attendance_activities aa
                set evening_autoclockout_warned_at = now()
                where aa.employee_id = v_row.employee_id
                  and aa.clocked_out_at is null
                  and aa.evening_autoclockout_warned_at is null;
        exception when others then
            raise warning 'attendance.autoclockout_approaching (evening) failed for employee %: %',
                v_row.employee_id, sqlerrm;
        end;
    end loop;
end;
$$;
