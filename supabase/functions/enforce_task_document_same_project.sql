-- arguments: none (trigger function)
-- returns: trigger
--
-- The cross-table integrity rule this junction introduces: a
-- task_documents row must never link a document to a task in a DIFFERENT
-- project than the document's own project_id. Enforced at the DATABASE
-- level, same rationale as enforce_task_assignee_is_project_member.sql --
-- RLS alone is bypassable by anyone hitting the REST API directly with
-- valid creds against a mismatched row, and the "Superadmin CRUD" policy
-- on task_documents grants UPDATE too (no `for` clause), so this also has
-- to guard a superadmin directly re-pointing task_id or document_id post-
-- insert. Fires on INSERT and UPDATE OF EITHER column that could re-point
-- this row -- not just document_id, task_id can equally be re-pointed at
-- a task in a different project, same integrity hole.
--
-- Deliberately NOT SECURITY DEFINER: the only legitimate caller already
-- passed task_documents_crud.sql's own INSERT policy, which requires
-- being a working project member of the task's own project already --
-- meaning they already have legitimate SELECT visibility into
-- tasks/documents for that project (req #6). Same rationale as
-- enforce_task_assignee_is_project_member -- no self-reference/recursion
-- risk here to justify SECURITY DEFINER.
create or replace function public.enforce_task_document_same_project()
returns trigger
language plpgsql
as $$
declare
    v_task_project_id     uuid;
    v_document_project_id uuid;
begin
    select project_id into v_task_project_id from public.tasks where id = new.task_id;
    select project_id into v_document_project_id from public.documents where id = new.document_id;

    if v_task_project_id is distinct from v_document_project_id then
        raise exception
            'This document belongs to a different project than the task it is being linked to. Attach the document to this task''s own project first.'
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;
