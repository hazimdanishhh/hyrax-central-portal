-- arguments: none (trigger function)
-- returns: trigger
--
-- Plugs into the existing, already-shipped event-driven notification
-- system. Same dynamic-recipient loop shape as
-- notify_task_status_changed.sql.
--
-- CASCADE GUARD, same shape/rationale as
-- block_project_member_removal_with_active_tasks.sql -- tasks.project_id
-- is ON DELETE CASCADE from projects (guard_project_deletion() only
-- allows a project delete once it has zero tasks anyway, so this mostly
-- protects the superadmin-bypass path, but the guard is cheap and keeps
-- this trigger correct regardless of how that invariant evolves).
--
-- BEFORE DELETE (not AFTER): task_assignees also cascades from tasks, and
-- must still be queryable here to resolve recipients. Postgres sweeps a
-- row's own cascaded children only once that row's DELETE (including its
-- BEFORE-trigger phase) is actually applied -- so task_assignees rows for
-- old.id are still present when this fires, whether the delete is a
-- direct single-task delete or itself part of a project-level cascade.
--
-- SECURITY DEFINER + set search_path = '': resolves each recipient's
-- profile_id regardless of the ACTING user's own RLS visibility into
-- employees -- same reasoning block_role_change_to_cc_with_active_tasks.sql
-- gives for the identical hardening.
create or replace function public.notify_task_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_actor_employee_id uuid;
    v_recipient record;
begin
    if not exists (select 1 from public.projects where id = old.project_id) then
        return old; -- whole project is being deleted (cascade), not a standalone task delete
    end if;

    v_actor_employee_id := public.current_employee_id();

    for v_recipient in
        select e.profile_id
        from public.task_assignees ta
        join public.employees e on e.id = ta.employee_id
        where ta.task_id = old.id
          and ta.employee_id is distinct from v_actor_employee_id
          and e.profile_id is not null
    loop
        begin
            perform public.emit_notification_event(
                'task.deleted', 'tasks', old.id::text,
                jsonb_build_object(
                    'task_id', old.id,
                    'project_id', old.project_id,
                    'task_title', old.title,
                    'recipient_profile_id', v_recipient.profile_id,
                    'deleted_by', v_actor_employee_id,
                    'title', 'Task Deleted',
                    'message', format('Task "%s" was deleted.', old.title),
                    'link_to', '/app/workspace/projects/' || old.project_id || '/tasks'
                )
            );
        exception when others then
            raise warning 'task.deleted notification failed for task % recipient %: %',
                old.id, v_recipient.profile_id, sqlerrm;
        end;
    end loop;

    return old;
end;
$$;
