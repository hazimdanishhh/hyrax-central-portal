-- arguments: none (trigger function)
-- returns: trigger
--
-- Plugs into the existing event-driven notification system (see
-- docs/NOTIFICATIONS-ARCHITECTURE.md) -- no new plumbing, just a new event
-- type. Fires on ANY clocked_out_at transition from null to non-null,
-- regardless of which code path caused it: clockOutAttendanceActivity's
-- manual UPDATE, auto_clock_out_app_on_scan()'s scanner-triggered UPDATE, or
-- auto_clock_out()'s cutoff-triggered UPDATE -- all three already converge
-- on the same underlying UPDATE ... SET clocked_out_at = ... against this
-- table, so ONE trigger here covers all three closure paths without a
-- separate emit_notification_event() call bolted onto each of those three
-- functions.
--
-- Reason inference is best-effort, from data already on hand (no new
-- columns, no cross-function signaling):
--   - Scanner-caused: auto_clock_out_app_on_scan() sets clocked_out_at =
--     the scan's own scanned_at verbatim, so an exact-timestamp match
--     against attendance_logs for this employee is a reliable signal.
--   - Cutoff-caused: auto_clock_out() sets clocked_out_at = now(), always
--     at ~17:00 or ~23:59 MYT -- checked via a narrow time-of-day window.
--   - Otherwise: a manual clock-out.
--
-- Wrapped in begin...exception when others... (matches
-- notify_task_assigned()'s own convention) -- a notification failure must
-- never roll back the actual clock-out update.
create or replace function public.notify_attendance_clocked_out()
returns trigger
language plpgsql
as $$
declare
    v_employee_profile_id uuid;
    v_type_name text;
    v_scanner_location text;
    v_local_time time;
    v_message text;
begin
    select e.profile_id into v_employee_profile_id
    from public.employees e where e.id = new.employee_id;

    if v_employee_profile_id is null then
        return new; -- no linked profile yet -- nobody to notify
    end if;

    select at.name into v_type_name
    from public.attendance_types at where at.id = new.attendance_type_id;

    -- Scanner-caused? auto_clock_out_app_on_scan() sets clocked_out_at to
    -- the scan's own scanned_at verbatim -- an exact match is reliable.
    select al.scanner_location into v_scanner_location
    from public.attendance_logs al
    join public.employees e on e.employee_id = al.employee_id
    where e.id = new.employee_id
      and al.scanned_at = new.clocked_out_at
    limit 1;

    if v_scanner_location is not null then
        v_message := format(
            'Your remote work session (%s) ended because you badged in at %s at %s.',
            coalesce(v_type_name, 'remote work'),
            v_scanner_location,
            to_char(new.clocked_out_at at time zone 'Asia/Kuala_Lumpur', 'HH12:MI AM')
        );
    else
        v_local_time := (new.clocked_out_at at time zone 'Asia/Kuala_Lumpur')::time;

        if v_local_time between '16:58:00' and '17:02:00' then
            v_message := format(
                'Your remote work session (%s) was automatically clocked out at the 5:00 PM MYT end-of-day cutoff.',
                coalesce(v_type_name, 'remote work')
            );
        elsif v_local_time between '23:57:00' and '23:59:59' then
            v_message := format(
                'Your remote work session (%s) was automatically clocked out at the 11:59 PM MYT end-of-day cutoff.',
                coalesce(v_type_name, 'remote work')
            );
        else
            v_message := format(
                'You clocked out of %s at %s.',
                coalesce(v_type_name, 'remote work'),
                to_char(new.clocked_out_at at time zone 'Asia/Kuala_Lumpur', 'HH12:MI AM')
            );
        end if;
    end if;

    begin
        perform public.emit_notification_event(
            'attendance.clocked_out_remote', 'attendance_activities', new.id::text,
            jsonb_build_object(
                'activity_id', new.id,
                'employee_id', new.employee_id,
                'employee_profile_id', v_employee_profile_id,
                'title', 'Remote Work Clocked Out',
                'message', v_message,
                'link_to', '/app/employee/attendance/list'
            )
        );
    exception when others then
        raise warning 'attendance.clocked_out_remote notification failed for activity %: %',
            new.id, sqlerrm;
    end;

    return new;
end;
$$;
