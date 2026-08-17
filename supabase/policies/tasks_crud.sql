-- SELECT: ALL tasks visible to ALL project members, incl. cc (req #6).
-- INSERT: working members only (owner/lead/member) -- a cc cannot create
-- tasks. UPDATE: ONLY the task's own assignees -- covers both "details"
-- and "status" per req #6's own wording; unchanged by the tier rework.
-- DELETE: elevated tier only (owner/lead) -- per the permission-tier
-- redesign, no longer flat.
create policy "Superadmin CRUD" on public.tasks
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "Project members can view all tasks" on public.tasks
for select to authenticated
using (public.is_project_member(project_id));

create policy "Working members can create tasks" on public.tasks
for insert to authenticated
with check (public.is_working_project_member(project_id));

create policy "Assignees can update their tasks" on public.tasks
for update to authenticated
using (public.is_task_assignee(id))
with check (public.is_task_assignee(id));

create policy "Elevated members can delete tasks" on public.tasks
for delete to authenticated
using (public.is_elevated_project_member(project_id));
