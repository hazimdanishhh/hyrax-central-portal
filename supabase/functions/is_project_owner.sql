-- arguments: p_project_id uuid
-- returns: boolean
--
-- Narrowest tier -- owner only. Used for the projects DELETE policy
-- (project deletion was never flat and stays owner-only) and inside
-- transfer_project_ownership() for its own authorization check.
--
-- SECURITY DEFINER + language plpgsql + set search_path = '' -- same
-- recursion rationale as is_elevated_project_member.sql.
create or replace function public.is_project_owner(p_project_id uuid)
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
          and pm.role = 'owner'
    );
end;
$$;
