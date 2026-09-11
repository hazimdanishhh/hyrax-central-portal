-- arguments: none (trigger function)
-- returns: trigger
--
-- Plugs into the existing, already-shipped event-driven notification
-- system (see docs/NOTIFICATIONS-ARCHITECTURE.md) -- no new plumbing
-- needed, just a new event type.
--
-- CASCADE GUARD: documents.project_id is ON DELETE CASCADE from projects,
-- and guard_project_deletion() only blocks a hard project delete when the
-- project still has TASKS -- a project with documents but zero tasks (or
-- a superadmin bypass) can be deleted directly, cascading through every
-- one of its documents. Without this guard, that single project deletion
-- would fan out one "your document was removed" notification per
-- document -- the same class of noise
-- block_owner_removal_from_project_members.sql and
-- block_project_member_removal_with_active_tasks.sql already guard
-- against on their own tables.
--
-- Skips when the uploader removes their own document -- they already
-- know, same reasoning as every other self-action skip in this module.
--
-- Deliberately does NOT also notify affected tasks' assignees --
-- task_documents cascading away with the document is the existing,
-- confirmed "warn and allow" product decision (see
-- docs/PROJECTS-TASKS-ARCHITECTURE.md); this stays a single clean
-- recipient (the uploader), matching the tracker's original design.
--
-- SECURITY DEFINER + set search_path = '': resolves the uploader's
-- profile_id regardless of the ACTING user's own RLS visibility into
-- employees -- same reasoning block_role_change_to_cc_with_active_tasks.sql
-- gives for the identical hardening.
create or replace function public.notify_document_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uploader_profile_id uuid;
begin
    if not exists (select 1 from public.projects where id = old.project_id) then
        return old; -- whole project is being deleted (cascade), not a standalone removal
    end if;

    if public.current_employee_id() is not distinct from old.attached_by then
        return old; -- uploader removed their own document -- they already know
    end if;

    select e.profile_id into v_uploader_profile_id
    from public.employees e where e.id = old.attached_by;

    if v_uploader_profile_id is null then
        return old; -- no linked profile (or no attached_by) -- nobody to notify
    end if;

    begin
        perform public.emit_notification_event(
            'document.removed', 'documents', old.id::text,
            jsonb_build_object(
                'project_id', old.project_id,
                'document_id', old.id,
                'document_name', old.name,
                'attached_by_profile_id', v_uploader_profile_id,
                'removed_by', public.current_employee_id(),
                'title', 'Document Removed',
                'message', format('"%s" was removed from the project.', coalesce(old.name, 'A document')),
                'link_to', '/app/workspace/projects/' || old.project_id
            )
        );
    exception when others then
        raise warning 'document.removed notification failed for document %: %', old.id, sqlerrm;
    end;

    return old;
end;
$$;
