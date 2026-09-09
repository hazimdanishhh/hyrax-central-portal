-- arguments: p_employee_code text, p_scanner_location text, p_work_date date
-- returns: setof (scanned_at timestamptz)
--
-- Backs the "click an Office/Blending Plant timeline card to see the
-- underlying raw scans" feature. Plain (not SECURITY DEFINER) -- runs as
-- the calling user, so attendance_logs' own RLS policies
-- (supabase/policies/attendance_logs_crud.sql) apply exactly as they would
-- to a direct client query. This function exists only because PostgREST's
-- column-filter-only query builder can't express the
-- DATE(scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur') = p_work_date bucketing
-- every other attendance surface already uses -- reused here server-side
-- instead of relying on client-side timezone arithmetic.
create or replace function public.get_attendance_log_scans(
    p_employee_code text,
    p_scanner_location text,
    p_work_date date
)
returns table (scanned_at timestamptz)
language sql
stable
as $$
    select al.scanned_at
    from public.attendance_logs al
    where al.employee_id = p_employee_code
      and al.scanner_location = p_scanner_location
      and date(al.scanned_at at time zone 'Asia/Kuala_Lumpur') = p_work_date
    order by al.scanned_at asc;
$$;
