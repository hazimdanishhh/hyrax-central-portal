-- arguments: none (trigger function)
-- returns: trigger
--
-- Req #5, enforced at the DATABASE level -- RLS alone is bypassable by
-- anyone hitting the REST API directly with valid creds against a
-- DIFFERENT row than their own. Rejects a NON-member outright, and
-- separately rejects a 'cc' target specifically -- a CC is a project
-- member (and appears in project_members) but must never be assignable to
-- a task. Fires on INSERT and UPDATE OF EITHER column that could
-- re-point this row -- not just employee_id (task_id can equally be
-- re-pointed at a different task, same integrity hole).
--
-- Deliberately NOT SECURITY DEFINER: the only legitimate caller here
-- already passed task_assignees_crud.sql's own INSERT policy, which
-- requires being a working project member already -- meaning they
-- already have legitimate SELECT visibility into project_members/tasks
-- for that project (req #6). Contrast with is_project_member() /
-- is_working_project_member() etc, which DO need SECURITY DEFINER
-- because they're evaluated from policies on those same tables (the
-- recursion problem) -- this trigger has no such self-reference.
create or replace function public.enforce_task_assignee_is_project_member()
returns trigger
language plpgsql
as $$
declare
    v_project_id uuid;
    v_role text;
begin
    select project_id into v_project_id from public.tasks where id = new.task_id;

    select pm.role into v_role
    from public.project_members pm
    where pm.project_id = v_project_id and pm.employee_id = new.employee_id;

    if v_role is null then
        raise exception
            'Employee % is not a member of this task''s project and cannot be assigned to it. Add them to the project first.',
            new.employee_id
            using errcode = 'check_violation';
    end if;

    if v_role = 'cc' then
        raise exception
            'Employee % is only CC''d on this project (view-only) and cannot be assigned to tasks. Change their project role to member or lead first.',
            new.employee_id
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;
