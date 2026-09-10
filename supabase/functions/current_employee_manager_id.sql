-- arguments: none
-- returns: uuid (caller's own employees.manager_id, or null if unlinked/no manager)
--
-- SECURITY DEFINER for the same reason as current_employee_id() -- this
-- resolves correctly regardless of employees' own RLS posture, and avoids a
-- self-referencing subquery directly inside a policy on employees (the
-- classic infinite-recursion trap current_employee_id()'s own callers
-- already have to avoid). language plpgsql (never sql, which Postgres can
-- inline and silently drop SECURITY DEFINER from) + set search_path = '' +
-- fully-qualified names: same hardening as current_employee_id()/
-- is_superadmin().
--
-- Used by "Employees can view their own manager's record" (see
-- employees_manager_view.sql) so a self-service employee can see their own
-- manager's name (e.g. unified_daily_attendance's manager_name column) once
-- that view runs with security_invoker = on.
create or replace function public.current_employee_manager_id()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
    return (select manager_id from public.employees where profile_id = auth.uid());
end;
$$;
