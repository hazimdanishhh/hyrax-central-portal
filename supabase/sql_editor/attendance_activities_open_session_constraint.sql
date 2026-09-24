-- One open app attendance session per employee, enforced by the database.
--
-- Run this once in the Supabase SQL editor. Idempotent.
--
-- RUN THE PRE-FLIGHT QUERY AT THE BOTTOM FIRST. If any employee already has
-- more than one open session, the index will fail to create and nothing else
-- in this file will run.
--
-- ===========================================================================
-- WHY
-- ===========================================================================
-- There was no uniqueness constraint of any kind on this table -- the only
-- index is the non-unique one from attendance_activities_add_entry_method_
-- columns.sql:68-69. Meanwhile useAttendanceActivityMutations.js:14-15 has
-- advertised a friendly duplicate message ("Only one active attendance
-- activity per employee") for a constraint that was never created, so the
-- application has believed this was enforced for some time.
--
-- The failure is self-amplifying, which is what makes it a rollout blocker
-- rather than a tidy-up:
--
--   1. A double-click (or a slow upload, or a flaky connection retry) creates
--      two open rows. Confirmed in production on the HR Add Activity form.
--   2. AttendanceProvider reads the open session with .maybeSingle(). Two rows
--      make PostgREST return PGRST116.
--   3. Its catch sets currentActivity = null, so the widget decides the
--      employee is NOT clocked in and offers "Clock In" again.
--   4. The next click creates a third row. The employee cannot clock out, and
--      cannot get back to a good state without HR editing the table.
--
-- At 80 employees clocking in within the same few minutes, step 1 stops being
-- an accident. The client-side guards added alongside this (a submitting ref,
-- and passing `saving` so the submit button actually disables) reduce how
-- often it is attempted; only this index makes it impossible.
--
-- A PARTIAL unique index, not a table constraint: the rule is "at most one row
-- WHERE clocked_out_at IS NULL". Closed sessions are unconstrained, so an
-- employee still has as many completed sessions per day as they like.
create unique index if not exists attendance_activities_one_open_session_per_employee
    on public.attendance_activities (employee_id)
    where clocked_out_at is null;

comment on index public.attendance_activities_one_open_session_per_employee is
    'At most one open (clocked_out_at IS NULL) app attendance session per '
    'employee. Guards the double-submit -> PGRST116 -> "Clock In" offered '
    'again -> third row cascade described in this index''s migration file.';

-- ===========================================================================
-- Sanity guard on session direction
-- ===========================================================================
-- Nothing prevented clocked_out_at < clocked_in_at. The auto-clock-out trigger
-- guards only its OWN writes against producing a negative span
-- (trigger_auto_clock_out.sql:20-22, 35-36); a direct write of any kind could
-- still store one, and a negative duration flows straight into hours_worked,
-- then overtime_hours, then the statutory rate tiers.
--
-- NOT VALID: existing rows are not checked, so this cannot fail on legacy
-- data. It applies to every INSERT and UPDATE from now on. Validate it
-- separately once you have confirmed no historical row violates it:
--
--   select count(*) from public.attendance_activities
--   where clocked_out_at is not null and clocked_out_at < clocked_in_at;
--
--   alter table public.attendance_activities
--     validate constraint attendance_activities_clock_out_after_in;
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'attendance_activities_clock_out_after_in'
          and conrelid = 'public.attendance_activities'::regclass
    ) then
        alter table public.attendance_activities
            add constraint attendance_activities_clock_out_after_in
            check (clocked_out_at is null or clocked_out_at >= clocked_in_at)
            not valid;
    end if;
end
$$;

-- ===========================================================================
-- PRE-FLIGHT -- run this BEFORE the statements above
-- ===========================================================================
-- Expect zero rows. Any employee listed here must be resolved first (close the
-- stale sessions, or delete the duplicates) or the unique index above will
-- fail with 23505 and nothing after it will run.
--
-- Note the two most likely sources of existing duplicates are both fixed in
-- this same pass, so this should stay empty afterwards: the missing
-- double-submit guard on the clock-in surfaces, and auto_clock_out()'s
-- timezone bug, which left every session opened before 08:00 MYT open forever.
--
--   select employee_id, count(*) as open_sessions,
--          min(clocked_in_at) as oldest, max(clocked_in_at) as newest
--   from public.attendance_activities
--   where clocked_out_at is null
--   group by employee_id
--   having count(*) > 1
--   order by open_sessions desc;
