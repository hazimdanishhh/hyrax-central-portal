-- arguments: none
-- returns: uuid (caller's own employees.id, or null if unlinked)
--
-- SECURITY DEFINER so this resolves correctly regardless of employees'
-- own RLS posture (not something this module owns/redesigns). language
-- plpgsql (never sql -- Postgres inlines simple sql-language functions
-- during planning, silently dropping SECURITY DEFINER) + set search_path
-- = '' + fully-qualified names: same hardening as public.is_superadmin().
create or replace function public.current_employee_id()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
    return (select id from public.employees where profile_id = auth.uid());
end;
$$;
