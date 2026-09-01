-- arguments: p_department_sub text
-- returns: boolean
--
-- "Is the current user in department X" check, parametrized like
-- is_project_member(p_project_id) rather than one hardcoded is_hr()/is_it()
-- function per department -- this module needs both HR and IT checks, and
-- every future department-gated table can reuse this same function instead
-- of growing a new one-off per department.
--
-- SECURITY DEFINER + language plpgsql (never sql -- Postgres inlines simple
-- sql-language functions during planning, silently dropping SECURITY
-- DEFINER) + set search_path = '': same hardening as is_superadmin()/
-- current_employee_id()/is_project_member(), and for the identical reason
-- -- safe to use in a policy defined on a table this function itself
-- queries indirectly (profiles/departments), without risking "infinite
-- recursion detected in policy".
create or replace function public.is_department(p_department_sub text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    return exists (
        select 1
        from public.profiles p
        join public.departments d on d.id = p.department_id
        where p.id = auth.uid() and d.sub = p_department_sub
    );
end;
$$;
