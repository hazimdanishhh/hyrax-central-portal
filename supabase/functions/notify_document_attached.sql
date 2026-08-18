-- arguments: none (trigger function)
-- returns: trigger
--
-- Plugs into the existing, already-shipped event-driven notification
-- system -- no new plumbing, just a new event type. Unlike
-- task.assigned/project.member_added (a single payload key resolves to
-- exactly one profiles.id), this event's audience is a *dynamic list* -- a
-- task's current assignees -- so this loops and calls
-- emit_notification_event() once per recipient (each call's payload
-- carries a single recipient_profile_id key), the fix
-- seed_projects_tasks_notification_rules.sql's own comment named for this
-- kind of event. No engine change needed.
--
-- task_documents.linked_by is never populated by the app today
-- (syncTaskDocumentLinks() only sets task_id/document_id), so the actor is
-- resolved via current_employee_id() (session-scoped, the same helper
-- get_or_create_document() already uses) rather than trusting NEW.linked_by.
--
-- Task-level attach only, by design -- a document added at the project
-- level (ProjectDocumentsTab's "Attach Document" flow, which only inserts
-- into documents, never task_documents) has no natural task-scoped
-- audience and is deliberately not covered by this trigger.
create or replace function public.notify_document_attached()
returns trigger
language plpgsql
as $$
declare
    v_task_title text;
    v_project_id uuid;
    v_document_name text;
    v_actor_employee_id uuid;
    v_recipient record;
begin
    select t.title, t.project_id into v_task_title, v_project_id
    from public.tasks t where t.id = new.task_id;

    select d.name into v_document_name
    from public.documents d where d.id = new.document_id;

    v_actor_employee_id := public.current_employee_id();

    for v_recipient in
        select e.profile_id
        from public.task_assignees ta
        join public.employees e on e.id = ta.employee_id
        where ta.task_id = new.task_id
          and ta.employee_id is distinct from v_actor_employee_id
          and e.profile_id is not null
    loop
        begin
            perform public.emit_notification_event(
                'document.attached', 'task_documents',
                new.task_id::text || ':' || new.document_id::text,
                jsonb_build_object(
                    'task_id', new.task_id,
                    'project_id', v_project_id,
                    'document_id', new.document_id,
                    'recipient_profile_id', v_recipient.profile_id,
                    'title', 'Document Attached to Task',
                    'message', format('"%s" was attached to task "%s".',
                        coalesce(v_document_name, 'A document'), coalesce(v_task_title, 'a task')),
                    'link_to', '/app/workspace/tasks/' || new.task_id
                )
            );
        exception when others then
            raise warning 'document.attached notification failed for task % document % recipient %: %',
                new.task_id, new.document_id, v_recipient.profile_id, sqlerrm;
        end;
    end loop;

    return new;
end;
$$;
