-- arguments: none (trigger function)
-- returns: trigger
--
-- Same dynamic-recipient loop as notify_document_attached.sql /
-- notify_task_status_changed.sql -- audience is "every current project
-- member (any role -- owner/lead/member/cc all included; cc exists
-- specifically to stay informed of the project without executing tasks)
-- except whoever made the change", which target_payload_keys can't express
-- as a single rule (see seed_projects_tasks_notification_rules.sql's
-- original comment on task.status_changed for why -- the same reasoning
-- applies here). No WHEN clause on the trigger itself -- old.status IS
-- DISTINCT FROM new.status is checked in the body instead, matching every
-- other trigger function in this codebase.
create or replace function public.notify_project_status_changed()
returns trigger
language plpgsql
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
        select e.profile_id
        from public.project_members pm
        join public.employees e on e.id = pm.employee_id
        where pm.project_id = new.id
          and pm.employee_id is distinct from v_actor_employee_id
          and e.profile_id is not null
    loop
        begin
            perform public.emit_notification_event(
                'project.status_changed', 'projects', new.id::text,
                jsonb_build_object(
                    'project_id', new.id,
                    'old_status', old.status,
                    'new_status', new.status,
                    'recipient_profile_id', v_recipient.profile_id,
                    'title', 'Project Status Changed',
                    'message', format('Project "%s" moved from %s to %s.', new.name, old.status, new.status),
                    'link_to', '/app/workspace/projects/' || new.id || '/tasks'
                )
            );
        exception when others then
            raise warning 'project.status_changed notification failed for project % recipient %: %',
                new.id, v_recipient.profile_id, sqlerrm;
        end;
    end loop;

    return new;
end;
$$;
