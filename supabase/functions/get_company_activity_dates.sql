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
--
-- BOUNDED to 2 years back (2026-09), same window expected_shifts's own date
-- spine already enforces (hr_unified_daily_attendance_view.sql). Before this,
-- every single call -- even for one day -- ran an unbounded DISTINCT scan of
-- ALL of attendance_logs and attendance_activities, then threw away every
-- date the caller didn't ask for (confirmed: 249 of 250 returned dates
-- discarded on a single-day query, supabase/diagnostics/results/2a.csv).
-- Being SECURITY DEFINER plpgsql, this function's body is opaque to the
-- planner -- no caller-side WHERE clause can ever reach inside it, so it
-- needs its own bound rather than relying on the view to supply one. Lossless
-- against the view's actual behavior: any date this excludes is older than
-- expected_shifts's own floor and could never have reached the final result
-- anyway.
--
-- ROWS 800 (confirmed necessary, 2026-09, via a real full-year EXPLAIN
-- capture): a set-returning plpgsql function gives the planner NO row-count
-- estimate of its own -- Postgres defaulted to guessing ~5-11 rows here,
-- versus the ~250-380 dates this actually returns. That ~2000x
-- underestimate cascades through active_company_dates -> expected_shifts ->
-- every join built on top of the spine, and made the planner choose a
-- NESTED LOOP against daily_leave instead of a hash join -- a join that was
-- estimated to run 11 times ran 21,240 times instead, rescanning ~3,000
-- leave rows on every iteration (confirmed: "Rows Removed by Join Filter:
-- 63005561" -- 21,240 x ~2,967, ~90% of a 12.6s total query time on a
-- full-year request). ROWS gives the planner a realistic estimate to build
-- every downstream join's cost on -- 800 comfortably covers the ~730 dates
-- in the 2-year window this function is now bounded to, with headroom.
create or replace function public.get_company_activity_dates()
returns table (work_date date)
language plpgsql
stable
security definer
set search_path = ''
rows 800
as $$
begin
    return query
        select distinct date(scanned_at at time zone 'Asia/Kuala_Lumpur') as work_date
        from public.attendance_logs
        where scanned_at >= (current_date - interval '2 years')
        union
        select distinct date(clocked_in_at at time zone 'Asia/Kuala_Lumpur') as work_date
        from public.attendance_activities
        where clocked_in_at >= (current_date - interval '2 years');
end;
$$;
