-- arguments: p_task_id uuid
-- returns: boolean
--
-- "Is the caller assigned to this specific task" -- used for the tasks
-- UPDATE policy (covers both "details" and "status" per req #6's
-- wording: only an assignee can update a task, though every project
-- member including cc can still see it).
--
-- SECURITY DEFINER + language plpgsql + set search_path = '' -- same
-- hardening as public.is_superadmin() / is_project_member.sql.
create or replace function public.is_task_assignee(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    return exists (
        select 1
        from public.task_assignees ta
        join public.employees e on e.id = ta.employee_id
        where ta.task_id = p_task_id
          and e.profile_id = auth.uid()
    );
end;
$$;
