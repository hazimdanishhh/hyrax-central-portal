-- arguments: p_project_id uuid
-- returns: boolean
--
-- Broadest visibility check: ANY role, including 'cc'. Used for SELECT on
-- projects/tasks/project_members/task_assignees -- visibility stays equal
-- across all four permission tiers (req #6, and the CC concept's own
-- premise: a supervisor sees exactly what everyone else sees, they just
-- can't act on it).
--
-- SECURITY DEFINER + language plpgsql (never sql) + set search_path = ''
-- -- safe to use in a policy defined ON project_members itself, mirroring
-- public.is_superadmin()'s exact rationale: a plain inline EXISTS(...)
-- inside a policy on the same table it queries causes "infinite recursion
-- detected in policy for relation ...", and Postgres inlines simple
-- sql-language functions during planning, which would silently discard
-- the SECURITY DEFINER context if this were `language sql`.
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    return exists (
        select 1
        from public.project_members pm
        where pm.project_id = p_project_id
          and pm.employee_id = public.current_employee_id()
    );
end;
$$;
