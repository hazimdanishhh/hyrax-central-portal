-- get_attendance_backfill_prefill: everything the Backfill Attendance wizard
-- needs to render sensible, per-employee-per-date defaults BEFORE anything is
-- written.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 7.
--
-- Answers, for each (employee, date) the user has selected:
--   - what times should this default to?        -> shift_end_time
--   - should this date be pre-ticked at all?    -> is_weekend, is_public_holiday,
--                                                  is_on_leave, has_existing_attendance
--   - is one side of the day already known?     -> hw_check_in / hw_check_out /
--                                                  app_check_in / app_check_out
--
-- Reads unified_daily_attendance DIRECTLY rather than recomputing anything --
-- that view already carries every column above, including work_location_id.
-- Duplicating even part of its logic here is exactly the drift this codebase
-- has repeatedly had to undo (the 09:00 late threshold, the hours_worked
-- expression). shift_end_time resolves through the SAME
-- coalesce(wl.early_leave_time, '17:00') the view's own is_early_leave and
-- normal_hours_threshold use, so the wizard's "default clock-out" and the
-- view's "left early" threshold can never disagree.
--
-- NOT security definer, deliberately -- same reasoning
-- supabase/functions/get_attendance_log_scans.sql documents for itself: it
-- runs under the caller's own privileges, so unified_daily_attendance's
-- security_invoker = on makes the existing RLS (self / HR / direct manager)
-- apply exactly as it would to a direct query. A manager calling this can only
-- ever see their own direct reports; an employee only themselves. There is no
-- authorization logic to get wrong here because there is none to write.
--
-- stable: pure read, consistent within a statement.
create or replace function public.get_attendance_backfill_prefill(
    p_employee_ids uuid[],
    p_dates        date[]
)
returns table (
    employee_id             uuid,
    full_name               text,
    work_location_id        bigint,
    work_location_name      text,
    shift_end_time          time,
    work_date               date,
    is_weekend              boolean,
    is_public_holiday       boolean,
    public_holiday_name     text,
    is_on_leave             boolean,
    leave_day_fraction      numeric,
    hr_flag                 text,
    hw_check_in             timestamp,
    hw_check_out            timestamp,
    app_check_in            timestamp,
    app_check_out           timestamp,
    hours_worked            numeric,
    has_existing_attendance boolean
)
language sql
stable
as $$
    select
        uda.employee_uuid,
        uda.full_name,
        uda.work_location_id,
        uda.work_location_name,
        -- Same COALESCE fallback the view itself applies for an employee with
        -- no assigned work location.
        coalesce(wl.early_leave_time, time '17:00:00') as shift_end_time,
        uda.work_date,
        uda.is_weekend,
        uda.is_public_holiday,
        uda.public_holiday_name,
        uda.is_on_leave,
        uda.leave_day_fraction,
        uda.hr_flag,
        uda.hw_check_in,
        uda.hw_check_out,
        uda.app_check_in,
        uda.app_check_out,
        uda.hours_worked,
        -- "Is there already something here?" -- drives pre-unticking a date
        -- the employee clearly already has covered. Intentionally broader than
        -- the RPC's own overlap check (which is about hours double-counting):
        -- this is about not offering to fill a day that looks complete.
        (uda.hw_check_in is not null or uda.app_check_in is not null)
            as has_existing_attendance
    from public.unified_daily_attendance uda
    left join public.work_locations wl on wl.id = uda.work_location_id
    -- BOTH predicates matter for performance, not just correctness. They have
    -- to be pushed down into expected_shifts' cross join -- an unfiltered read
    -- of this view materializes every active employee against the entire
    -- multi-year date spine, which is the exact shape of the statement-timeout
    -- regression documented in
    -- docs/hr/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md. With the small explicit
    -- arrays the wizard sends, this stays cheap.
    where uda.employee_uuid = any(p_employee_ids)
      and uda.work_date = any(p_dates);
$$;

grant execute on function public.get_attendance_backfill_prefill(uuid[], date[])
    to authenticated;
