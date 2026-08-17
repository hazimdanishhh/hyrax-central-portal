-- arguments: p_project_id uuid, p_employee_id uuid
-- returns: text (the role, or null if not a member)
--
-- Every helper above only ever answers "what's auth.uid()'s OWN role" --
-- this one answers "what's THIS ARBITRARY employee's role", needed
-- because task_assignees' INSERT policy has to validate the role of the
-- row being inserted (new employee_id, the assignee-to-be), not the
-- caller's own role -- a 'cc' target must be rejected even when the
-- caller themselves is a legitimate working member.
--
-- SECURITY DEFINER + language plpgsql + set search_path = '' -- same
-- recursion rationale as the other helpers; kept consistent even though
-- its only current caller (task_assignees) isn't self-referential, for
-- reuse safety if this ever gets called from project_members' own
-- policies later.
create or replace function public.project_member_role(p_project_id uuid, p_employee_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_role text;
begin
    select pm.role into v_role
    from public.project_members pm
    where pm.project_id = p_project_id and pm.employee_id = p_employee_id;

    return v_role;
end;
$$;
