-- arguments: p_project_id uuid
-- returns: boolean
--
-- "Working member" = owner/lead/member -- anyone actually expected to
-- execute or manage work on the project. Excludes 'cc', who is a
-- view-only supervisor. Used for: tasks INSERT (task creation),
-- task_assignees INSERT/DELETE (the caller's own gate -- a cc cannot
-- assign or unassign anyone).
--
-- SECURITY DEFINER + language plpgsql + set search_path = '' -- same
-- recursion rationale as is_project_member.sql. Not optional here: this
-- function is called from project_members-adjacent policies, and (via
-- is_elevated_project_member) indirectly from project_members' OWN RLS
-- policies -- without SECURITY DEFINER that self-reference would loop
-- forever, identical in shape to the profiles-on-profiles case documented
-- in supabase/policies/profiles_crud.sql.
create or replace function public.is_working_project_member(p_project_id uuid)
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
          and pm.role in ('owner', 'lead', 'member')
    );
end;
$$;
