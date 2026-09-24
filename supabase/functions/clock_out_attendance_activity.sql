-- clock_out_attendance_activity: close an open attendance_activities session,
-- stamping clocked_out_at from the DATABASE's own clock.
--
-- Run this once in the Supabase SQL editor. Re-runnable (CREATE OR REPLACE).
--
-- ===========================================================================
-- WHY THIS EXISTS -- confirmed in production, 2026-09
-- ===========================================================================
-- Every live clock-out (ClockinMini, TodayAttendanceCard, the HR timeline
-- card's own clock-out button, My/Team Attendance) went straight to
--     supabase.from('attendance_activities').update({ clocked_out_at: new
--     Date().toISOString() })
-- -- a value computed on the EMPLOYEE'S OWN DEVICE, not the server. clocked_in_at
-- has never had this problem: it is left off the insert entirely and falls back
-- to the column's own `DEFAULT now()`, which is the database's clock.
-- clocked_out_at got no equivalent treatment.
--
-- A device clock that is wrong -- unsynced, manually set, mid-flight without
-- auto-update -- produces a clocked_out_at that is not just off by a few
-- minutes but potentially BEFORE clocked_in_at. That is exactly what a
-- corrupted production row showed: clocked_in_at at 6-decimal (database
-- `now()`) precision from the insert's own default, clocked_out_at at 3-decimal
-- (JS `toISOString()`) precision almost a full day EARLIER from the update.
-- Nothing rejected it at write time (no CHECK existed yet -- see
-- attendance_activities_open_session_constraint.sql), and it later made
-- create_attendance_submission_rpc.sql's overlap check crash outright:
-- tstzrange() cannot be built from a backwards interval, so every future
-- submission for that employee failed with a raw "range lower bound must be
-- less than or equal to range upper bound" until the row was found and fixed.
--
-- The fix is the same one clocked_in_at already has: never trust the caller's
-- clock for a value this consequential. `now()` here is evaluated by Postgres,
-- once, inside the same statement that closes the session -- no client value
-- is ever accepted.
--
-- ===========================================================================
-- AUTHORIZATION
-- ===========================================================================
-- Reused verbatim from create_attendance_submission_rpc.sql: superadmin, HR,
-- the employee's own manager, or the employee themselves. This function is
-- called from every clock-out surface, not only the employee's own ClockinMini
-- -- HR's timeline card and the HR/Team Attendance day sidebars all close
-- OTHER employees' open sessions through this same path, so it cannot be
-- self-only.
create or replace function public.clock_out_attendance_activity(
    p_activity_id uuid
) returns public.attendance_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_employee_id uuid;
    v_is_superadmin     boolean;
    v_is_hr             boolean;
    v_is_manager        boolean;
    v_is_self           boolean;
    v_activity          public.attendance_activities;
    v_result            public.attendance_activities;
begin
    select id into v_actor_employee_id
    from public.employees where profile_id = auth.uid() limit 1;

    if v_actor_employee_id is null then
        raise exception 'No employee record is linked to your account';
    end if;

    select * into v_activity from public.attendance_activities
    where id = p_activity_id;
    if not found then
        raise exception 'Attendance activity not found';
    end if;

    v_is_superadmin := public.is_superadmin();
    v_is_self       := (v_activity.employee_id = v_actor_employee_id);
    v_is_hr := exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    );
    v_is_manager := exists (
        select 1 from public.employees e
        where e.id = v_activity.employee_id and e.manager_id = v_actor_employee_id
    );

    if not (v_is_superadmin or v_is_hr or v_is_manager or v_is_self) then
        raise exception 'Not authorized to clock out this employee';
    end if;

    update public.attendance_activities
    set clocked_out_at = now()
    where id = p_activity_id
      and clocked_out_at is null
    returning * into v_result;

    if v_result.id is null then
        raise exception 'This session is already clocked out';
    end if;

    return v_result;
end;
$$;

grant execute on function public.clock_out_attendance_activity(uuid) to authenticated;
