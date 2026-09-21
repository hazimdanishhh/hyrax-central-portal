-- arguments: none (trigger function)
-- returns: trigger
--
-- Plugs into the existing event-driven notification system (see
-- docs/NOTIFICATIONS-ARCHITECTURE.md) -- no new plumbing, just a new event
-- type. target_payload_keys resolves 'employee_profile_id' to exactly one
-- profiles.id: the employee notifying themselves that their own remote
-- clock-in registered, same "notify the one person this event is about"
-- shape as notify_task_assigned.sql.
--
-- Fires only on a LIVE self clock-in. It used to fire on every insert, which
-- was correct while the app had exactly one insert path -- but
-- create_attendance_backfill() now also writes here, and a backfill row is a
-- CLOSED session dated in the past. Telling someone "You are now clocked in,
-- remember to clock out" about a day they already finished (times ten, for a
-- ten-day backfill) is wrong on every count.
--
-- Guarded in two places on purpose: the trigger's own WHEN clause (so the
-- function isn't even called, which is what keeps a bulk backfill cheap) and
-- the early return below (so the function is correct on its own terms, for any
-- future caller that attaches it differently). The clocked_out_at half of the
-- guard is load-bearing rather than belt-and-braces: entry_method has a
-- DEFAULT, so a future insert path that simply forgets to set it would
-- otherwise slip straight through the entry_method check.
--
-- Wrapped in begin...exception when others... (matches
-- notify_profile_created()/notify_task_assigned()'s own convention) -- a
-- notification failure must never roll back the actual clock-in insert.
create or replace function public.notify_attendance_clocked_in()
returns trigger
language plpgsql
as $$
declare
    v_employee_profile_id uuid;
    v_employee_name text;
    v_type_name text;
begin
    -- Only a live, still-open self clock-in produces this notification. A
    -- backfilled/reconciled row is already closed and usually dated in the
    -- past -- create_attendance_backfill() emits its own aggregated
    -- 'attendance.backfilled' event instead, once per employee rather than
    -- once per row.
    if new.entry_method is distinct from 'self_clock_in'
       or new.clocked_out_at is not null then
        return new;
    end if;

    select e.profile_id, e.full_name into v_employee_profile_id, v_employee_name
    from public.employees e where e.id = new.employee_id;

    if v_employee_profile_id is null then
        return new; -- no linked profile yet -- nobody to notify
    end if;

    select at.name into v_type_name
    from public.attendance_types at where at.id = new.attendance_type_id;

    begin
        perform public.emit_notification_event(
            'attendance.clocked_in_remote', 'attendance_activities', new.id::text,
            jsonb_build_object(
                'activity_id', new.id,
                'employee_id', new.employee_id,
                'employee_profile_id', v_employee_profile_id,
                'attendance_type_id', new.attendance_type_id,
                'title', 'Clocked In For Remote Work',
                'message', format(
                    'You are now clocked in for %s. Remember to clock out when you''re done -- you''ll be automatically clocked out around 5:00 PM or 11:59 PM MYT if it''s still open by then. HR and your manager can review, approve/reject, or adjust attendance records as needed.',
                    coalesce(v_type_name, 'remote work')
                ),
                'link_to', '/app/employee/attendance/list'
            )
        );
    exception when others then
        raise warning 'attendance.clocked_in_remote notification failed for activity %: %',
            new.id, sqlerrm;
    end;

    return new;
end;
$$;
