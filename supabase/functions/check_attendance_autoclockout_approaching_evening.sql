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
    for v_row in
        select
            aa.id,
            aa.employee_id,
            e.profile_id as employee_profile_id,
            at.name as type_name
        from public.attendance_activities aa
        join public.employees e on e.id = aa.employee_id
        left join public.attendance_types at on at.id = aa.attendance_type_id
        where aa.clocked_out_at is null
          and aa.evening_autoclockout_warned_at is null
    loop
        begin
            if v_row.employee_profile_id is null then
                continue; -- no linked profile yet -- nobody to notify
            end if;

            perform public.emit_notification_event(
                'attendance.autoclockout_approaching', 'attendance_activities', v_row.id::text,
                jsonb_build_object(
                    'activity_id', v_row.id,
                    'employee_id', v_row.employee_id,
                    'employee_profile_id', v_row.employee_profile_id,
                    'notification_type', 'warning',
                    'title', 'You Will Be Automatically Clocked Out Soon',
                    'message', format(
                        'You''re still clocked in for %s. You''ll be automatically clocked out around 5:00 PM MYT if you don''t clock out yourself first. If you''re still working after that, clock in again for remote work.',
                        coalesce(v_row.type_name, 'remote work')
                    ),
                    'link_to', '/app/employee/attendance/list'
                )
            );

            update public.attendance_activities
                set evening_autoclockout_warned_at = now()
                where id = v_row.id;
        exception when others then
            raise warning 'attendance.autoclockout_approaching (evening) failed for activity %: %',
                v_row.id, sqlerrm;
        end;
    end loop;
end;
$$;
