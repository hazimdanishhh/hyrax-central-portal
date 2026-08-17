-- arguments: none (trigger function)
-- returns: trigger
--
-- Plugs into the existing, already-shipped event-driven notification
-- system (see docs/NOTIFICATIONS-ARCHITECTURE.md) -- no new plumbing
-- needed, just a new event type. target_payload_keys resolves
-- 'assignee_profile_id' to exactly one profiles.id, a perfect fit for
-- "notify the one person this event is about."
--
-- Wrapped in begin...exception when others... (matches
-- notify_profile_created()'s own convention) -- a notification failure
-- must never roll back the actual task-assignee insert.
create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
as $$
declare
    v_assignee_profile_id uuid;
    v_task_title text;
    v_project_id uuid;
begin
    -- Skip self-assignment -- someone assigning themselves already knows.
    if new.assigned_by is not distinct from new.employee_id then
        return new;
    end if;

    select e.profile_id into v_assignee_profile_id
    from public.employees e where e.id = new.employee_id;

    if v_assignee_profile_id is null then
        return new; -- no linked profile yet -- nobody to notify
    end if;

    select t.title, t.project_id into v_task_title, v_project_id
    from public.tasks t where t.id = new.task_id;

    begin
        perform public.emit_notification_event(
            'task.assigned', 'task_assignees',
            new.task_id::text || ':' || new.employee_id::text,
            jsonb_build_object(
                'task_id', new.task_id,
                'project_id', v_project_id,
                'employee_id', new.employee_id,
                'assignee_profile_id', v_assignee_profile_id,
                'assigned_by', new.assigned_by,
                'title', 'You Were Assigned a Task',
                'message', format('You were assigned to "%s".', coalesce(v_task_title, 'a task')),
                'link_to', '/app/workspace/tasks/' || new.task_id
            )
        );
    exception when others then
        raise warning 'task.assigned notification failed for task % employee %: %',
            new.task_id, new.employee_id, sqlerrm;
    end;

    return new;
end;
$$;
