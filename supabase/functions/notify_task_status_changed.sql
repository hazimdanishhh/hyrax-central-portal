-- arguments: none (trigger function)
-- returns: trigger
--
-- Same dynamic-recipient loop as notify_project_status_changed.sql --
-- audience is "this task's current assignees except whoever made the
-- change" (scoped to the task, not the whole project's membership --
-- mirrors task.assigned's scope of only notifying people directly on the
-- task). This is the exact event seed_projects_tasks_notification_rules.sql's
-- own comment named as needing this loop-and-emit fix -- see that file's
-- header for the original reasoning.
--
-- SECURITY DEFINER + set search_path = '' (added alongside the
-- Workspace lifecycle notifications pass, see
-- docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md): without this, the
-- `select e.profile_id from employees` lookup below runs under the
-- ACTING user's own RLS, which only allows self/HR/superadmin/direct-
-- manager visibility into employees -- a recipient outside that set
-- would silently be skipped. Same hardening
-- block_role_change_to_cc_with_active_tasks.sql already uses.
create or replace function public.notify_task_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_employee_id uuid;
    v_recipient record;
begin
    if old.status is not distinct from new.status then
        return new;
    end if;

    v_actor_employee_id := public.current_employee_id();

    for v_recipient in
        select ta.employee_id, e.profile_id
        from public.task_assignees ta
        join public.employees e on e.id = ta.employee_id
        where ta.task_id = new.id
          and ta.employee_id is distinct from v_actor_employee_id
          and e.profile_id is not null
    loop
        begin
            perform public.emit_notification_event(
                'task.status_changed', 'tasks', new.id::text,
                jsonb_build_object(
                    'task_id', new.id,
                    'project_id', new.project_id,
                    'old_status', old.status,
                    'new_status', new.status,
                    'recipient_profile_id', v_recipient.profile_id,
                    'title', 'Task Status Changed',
                    'message', format('Task "%s" moved from %s to %s.', new.title, old.status, new.status),
                    'link_to', public.task_notification_link(new.id, new.project_id, v_recipient.employee_id)
                )
            );
        exception when others then
            raise warning 'task.status_changed notification failed for task % recipient %: %',
                new.id, v_recipient.profile_id, sqlerrm;
        end;
    end loop;

    return new;
end;
$$;
