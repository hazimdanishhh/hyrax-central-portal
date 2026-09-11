-- arguments: none (trigger function)
-- returns: trigger
--
-- Symmetric counterpart to notify_task_assigned.sql. Plugs into the
-- existing, already-shipped event-driven notification system.
--
-- No cascade guard needed (unlike project_members/documents/tasks) --
-- task_assignees has no child rows of its own to protect against, and
-- notify_task_deleted.sql is a separate BEFORE-DELETE-on-tasks trigger
-- that runs independently before this table's own cascade sweep.
--
-- Self-unassignment skip, mirrored from task.assigned's self-assignment
-- skip -- but resolved via current_employee_id() rather than a
-- "removed_by" column, since task_assignees has no such column (only
-- assigned_by, captured at INSERT time).
--
-- SECURITY DEFINER + set search_path = '': resolves the removed
-- assignee's profile_id regardless of the ACTING user's own RLS
-- visibility into employees -- same reasoning
-- block_role_change_to_cc_with_active_tasks.sql gives for the identical
-- hardening.
create or replace function public.notify_task_unassigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_assignee_profile_id uuid;
    v_task_title text;
    v_project_id uuid;
begin
    if public.current_employee_id() is not distinct from old.employee_id then
        return old; -- self-unassignment -- they already know
    end if;

    select e.profile_id into v_assignee_profile_id
    from public.employees e where e.id = old.employee_id;

    if v_assignee_profile_id is null then
        return old;
    end if;

    select t.title, t.project_id into v_task_title, v_project_id
    from public.tasks t where t.id = old.task_id;

    begin
        perform public.emit_notification_event(
            'task.unassigned', 'task_assignees',
            old.task_id::text || ':' || old.employee_id::text,
            jsonb_build_object(
                'task_id', old.task_id,
                'project_id', v_project_id,
                'employee_id', old.employee_id,
                'assignee_profile_id', v_assignee_profile_id,
                'unassigned_by', public.current_employee_id(),
                'title', 'Removed from a Task',
                'message', format('You were unassigned from "%s".', coalesce(v_task_title, 'a task')),
                'link_to', public.task_notification_link(old.task_id, v_project_id, old.employee_id)
            )
        );
    exception when others then
        raise warning 'task.unassigned notification failed for task % employee %: %',
            old.task_id, old.employee_id, sqlerrm;
    end;

    return old;
end;
$$;
