-- arguments: none
-- returns: uuid (caller's own employees.id, or null if unlinked)
--
-- SECURITY DEFINER so this resolves correctly regardless of employees'
-- own RLS posture (not something this module owns/redesigns). language
-- plpgsql (never sql -- Postgres inlines simple sql-language functions
-- during planning, silently dropping SECURITY DEFINER) + set search_path
-- = '' + fully-qualified names: same hardening as public.is_superadmin().
-- STABLE (added 2026-09-22) -- this was omitted, so Postgres defaulted the
-- function to VOLATILE, and a VOLATILE function cannot be hoisted or cached:
-- the planner must call it ONCE PER ROW. This function is used in 11 RLS
-- policies and runs a query internally, and unified_daily_attendance scans
-- ~52,000 attendance_logs rows per request, so it was being executed tens of
-- thousands of times per page load. That was the bulk of a 3-5 second page.
--
-- STABLE is the accurate marker, not a trick: the result derives entirely
-- from auth.uid(), which is fixed for the duration of a request, and the
-- function writes nothing. Security is unaffected -- volatility is a planner
-- hint and has no bearing on SECURITY DEFINER or search_path.
create or replace function public.current_employee_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    return (select id from public.employees where profile_id = auth.uid());
end;
$$;
