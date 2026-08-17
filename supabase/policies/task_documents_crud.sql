-- SELECT: any project member, incl. cc -- same visibility symmetry as
-- task_assignees' own SELECT policy; a link row is only ever meaningful
-- alongside its task, so visibility is scoped by the task's project.
--
-- INSERT gates the CALLER (must be a working member of the task's own
-- project) -- linking an existing document to a task is project
-- contribution, same tier as attaching a document in the first place. The
-- cross-table "document must belong to the SAME project as the task"
-- rule is enforced by enforce_task_document_same_project()'s trigger
-- regardless of RLS outcome, not duplicated here -- same division of
-- labor as task_assignees_crud.sql's INSERT policy vs
-- enforce_task_assignee_is_project_member.sql's trigger.
--
-- DELETE: any working member -- unlinking a document from a task does
-- NOT delete the underlying document row, so this is lower-stakes than
-- documents' own DELETE policy (uploader-or-elevated) and doesn't need
-- that same restriction.
create policy "Superadmin CRUD" on public.task_documents
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "Project members can view task document links" on public.task_documents
for select to authenticated
using (public.is_project_member((select project_id from public.tasks where id = task_id)));

create policy "Working members can link documents to tasks" on public.task_documents
for insert to authenticated
with check (public.is_working_project_member((select project_id from public.tasks where id = task_id)));

create policy "Working members can unlink documents from tasks" on public.task_documents
for delete to authenticated
using (public.is_working_project_member((select project_id from public.tasks where id = task_id)));
