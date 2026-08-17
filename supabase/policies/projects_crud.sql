-- SELECT: visible to any member regardless of tier (owner/lead/member/cc)
-- -- req #6. INSERT: any linked employee -- with_check ties created_by to
-- current_employee_id(); if that's NULL (unlinked user), "created_by =
-- null" is never true, so an unlinked user's insert is rejected with no
-- extra clause needed. UPDATE: elevated tier only (owner/lead) -- per the
-- permission-tier redesign, no longer flat. DELETE: owner-only -- was
-- never flat, unchanged by this rework; guard_project_deletion's trigger
-- is an ADDITIONAL, separate check layered on top (blocks deleting a
-- non-empty, non-cancelled project), not a replacement.
create policy "Superadmin CRUD" on public.projects
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "Members can view their projects" on public.projects
for select to authenticated
using (public.is_project_member(id));

create policy "Linked employees can create projects" on public.projects
for insert to authenticated
with check (created_by = public.current_employee_id());

create policy "Elevated members can update their projects" on public.projects
for update to authenticated
using (public.is_elevated_project_member(id))
with check (public.is_elevated_project_member(id));

create policy "Owners can delete their projects" on public.projects
for delete to authenticated
using (public.is_project_owner(id));
