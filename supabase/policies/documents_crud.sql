-- SELECT: any project member, incl. cc -- same visibility symmetry as
-- "Project members can view all tasks" (req #6: a document is just
-- another thing everyone in the project can see, whether or not it's
-- linked to any task).
--
-- INSERT: any WORKING project member (owner/lead/member) -- mirrors
-- tasks' own "Working members can create tasks" policy. Also requires
-- attached_by = current_employee_id() -- a working member can attach a
-- document, but can't attribute it to someone else (that identity is
-- also what the DELETE policy below keys off).
--
-- DELETE: the uploader (self-service cleanup for a mistaken attach) OR an
-- elevated member (owner/lead) -- same tier that can already delete a
-- task outright. Deleting a document here cascades to remove every
-- task_documents link that pointed at it -- a deliberate, desired side
-- effect (see documents_schema_migration.sql's header comment), not a
-- footgun.
--
-- No UPDATE policy -- rows are immutable; "editing" a document's Drive
-- metadata is remove + re-attach.
create policy "Superadmin CRUD" on public.documents
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "Project members can view documents" on public.documents
for select to authenticated
using (public.is_project_member(project_id));

create policy "Working members can attach documents" on public.documents
for insert to authenticated
with check (
    public.is_working_project_member(project_id)
    and attached_by = public.current_employee_id()
);

create policy "Uploader or elevated members can remove documents" on public.documents
for delete to authenticated
using (
    attached_by = public.current_employee_id()
    or public.is_elevated_project_member(project_id)
);
