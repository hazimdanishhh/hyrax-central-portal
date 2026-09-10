-- arguments: none
-- returns: table(work_date date) -- every distinct date the company had
-- real attendance activity (hardware scan or app clock-in)
--
-- SECURITY DEFINER so unified_daily_attendance's active_company_dates spine
-- doesn't silently shrink to "only dates I personally have a row for" once
-- attendance_logs/attendance_activities' own RLS actually applies (i.e.
-- once unified_daily_attendance runs with security_invoker = on -- see
-- enable_attendance_views_security_invoker.sql). Without this, an ordinary
-- self-service employee querying the view would only see the calendar
-- dates *they themselves* scanned/clocked in on -- meaning a genuine
-- unexcused absence or a full-day approved-leave weekday (where they have
-- no attendance_logs/attendance_activities row at all) would never even
-- enter the spine, so no row would be generated for that day at all. That's
-- a worse version of the exact "silently missing" gap the public-holiday
-- and weekend date-generation branches already fix.
--
-- Deliberately narrow: this only ever reveals "some date had activity
-- somewhere in the company," never whose -- the same scope discipline as
-- this codebase's other SECURITY DEFINER helpers (current_employee_id(),
-- is_superadmin()). language plpgsql (never sql -- Postgres inlines simple
-- sql-language functions during planning, silently dropping SECURITY
-- DEFINER) + set search_path = '' + fully-qualified names: same hardening
-- convention as those helpers.
--
-- STABLE (not the plpgsql default of VOLATILE) matters a lot here: this is
-- called from inside unified_daily_attendance, which get_attendance_dashboard
-- and get_hr_reports_dashboard both read from many CTEs referencing many
-- times per call (period_rows/prev_period_rows/period_attendance). A
-- VOLATILE function gives the planner no reliable row-count estimate to
-- work with for the cross-join this feeds (expected_shifts), which can lead
-- it to pick a disastrously bad join plan once a query spans a wide date
-- range and every employee/department (the exact "canceling statement due
-- to statement timeout" failure mode) -- this function only reads, never
-- writes, and returns consistent results for the duration of one query, so
-- STABLE is both correct and necessary, not just an optimization nicety.
create or replace function public.get_company_activity_dates()
returns table (work_date date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    return query
        select distinct date(scanned_at at time zone 'Asia/Kuala_Lumpur') as work_date
        from public.attendance_logs
        union
        select distinct date(clocked_in_at at time zone 'Asia/Kuala_Lumpur') as work_date
        from public.attendance_activities;
end;
$$;
