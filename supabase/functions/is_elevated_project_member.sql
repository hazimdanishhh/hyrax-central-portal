-- arguments: p_project_id uuid
-- returns: boolean
--
-- "Elevated member" = owner/lead -- can edit project details, manage
-- membership/roles (except ever touching the 'owner' tag itself, which is
-- RLS-blocked outright and reachable only via
-- transfer_project_ownership()), and delete tasks. Project *deletion*
-- deliberately does NOT use this -- that stays owner-only via
-- is_project_owner() below.
--
-- SECURITY DEFINER + language plpgsql + set search_path = '' -- this is
-- called directly from project_members' own INSERT/UPDATE/DELETE
-- policies, which makes SECURITY DEFINER structurally required, not
-- stylistic: without it, evaluating a project_members policy would
-- re-query project_members to resolve this function's EXISTS check, which
-- re-triggers the same policy, forever ("infinite recursion detected in
-- policy for relation \"project_members\""), identical in shape to the
-- profiles-on-profiles bug documented in supabase/policies/profiles_crud.sql.
create or replace function public.is_elevated_project_member(p_project_id uuid)
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
          and pm.role in ('owner', 'lead')
    );
end;
$$;
