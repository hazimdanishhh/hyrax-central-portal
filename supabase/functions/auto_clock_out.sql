-- auto_clock_out: close app attendance sessions the employee never closed
-- themselves. Hardware scanner rows are untouched -- they are not sessions.
--
-- Run this once in the Supabase SQL editor. Re-runnable (CREATE OR REPLACE).
--
-- Called by pg_cron (see supabase/cron/) and by the auto-clock-out edge
-- function, which supplies the service-role key.
--
-- ===========================================================================
-- TIMEZONE FIX, 2026-09-24. This was a real, silent data bug.
-- ===========================================================================
-- The predicate used to be:
--
--     AND clocked_in_at::date = now()::date
--
-- Both sides evaluate in the DATABASE's timezone, which is UTC, while the
-- business day is MYT (UTC+8). A session opened before 08:00 MYT therefore
-- falls on the PREVIOUS UTC date, so `clocked_in_at::date` never equalled
-- `now()::date` for it -- and neither the 17:00 nor the 23:59 sweep ever
-- matched it.
--
-- Those sessions stayed open forever. Consequences, all of which were being
-- blamed on other things:
--   * the day reads "Missing App Check-Out" permanently
--   * the employee's Clock In button never comes back, because
--     AttendanceProvider looks for an open session and keeps finding one
--   * hours_worked for that day is computed from an unbounded span
--
-- Already self-documented as an open bug at
-- attendance_day_model_axes_migration.sql:82-87; this is the fix.
--
-- Comparing in MYT on BOTH sides is what makes "today" mean the same thing to
-- this function as it does to everyone using the app.
--
-- ===========================================================================
-- KNOWN LIMITATION, deliberately not changed here
-- ===========================================================================
-- This only ever closes sessions opened on the CURRENT MYT day. A session that
-- somehow survives past midnight -- the cron not running, a database restart --
-- is still stranded, because the next day's sweep no longer matches it. A
-- sweep bounded by age rather than by date (for example, anything open longer
-- than 24 hours) would be strictly more robust, but it changes which rows get
-- touched and needs its own decision; the one-open-session constraint in
-- attendance_activities_open_session_constraint.sql is the more direct
-- protection and lands first.
--
-- Also unchanged: the 17:00 MYT sweep closes anyone still working at 5 PM, and
-- their remaining hours are lost unless they notice and clock in again. That
-- is a policy question for HR, not a bug to fix silently.
CREATE OR REPLACE FUNCTION public.auto_clock_out()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- SECURITY DEFINER + an explicit guard, added 2026-09-24. This function
  -- previously ran as INVOKER with no authorization check and no REVOKE, so
  -- Postgres' default EXECUTE TO PUBLIC applied: any authenticated user could
  -- call it. RLS bounded the damage, but generously -- any HR user would
  -- force-close every open session company-wide, any manager their whole
  -- team's, in one REST call with no logging.
  --
  -- It is only ever called by pg_cron and by the edge function (service role),
  -- neither of which has a JWT, so auth.uid() is null for every legitimate
  -- call. Anything with a user attached is a call that should not be happening.
  IF auth.uid() IS NOT NULL AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'auto_clock_out is a scheduled job and cannot be called directly';
  END IF;

  UPDATE public.attendance_activities
  SET clocked_out_at = now()
  WHERE clocked_out_at IS NULL
    AND (clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur')::date
        = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;
END;
$$;

-- Belt and braces alongside the in-body guard: take away the default grant so
-- an ordinary session cannot even reach the function.
revoke execute on function public.auto_clock_out() from public;
revoke execute on function public.auto_clock_out() from authenticated;

-- ...then hand it back to the two callers that legitimately have it. Revoking
-- from PUBLIC removes it from service_role too, and the edge function
-- (supabase/edge_functions/auto-clock-out.ts) calls this with the service-role
-- key -- so without this grant the nightly sweep would start failing silently
-- the moment the revoke above runs. pg_cron runs as the function's owner and
-- needs no grant.
grant execute on function public.auto_clock_out() to service_role;
