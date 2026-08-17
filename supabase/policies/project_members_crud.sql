-- SELECT: roster visible to every role, incl. cc -- follows from "cc has
-- the same visibility as everyone else." INSERT/UPDATE: elevated tier
-- only (owner/lead), and explicitly forbid ever setting role to/from
-- 'owner' through this path -- ownership can only move via
-- transfer_project_ownership().
create policy "Superadmin CRUD" on public.project_members
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "Members can view project membership" on public.project_members
for select to authenticated
using (public.is_project_member(project_id));

create policy "Elevated members can add project members" on public.project_members
for insert to authenticated
with check (
    public.is_elevated_project_member(project_id)
    and role <> 'owner'
);

create policy "Elevated members can update project membership" on public.project_members
for update to authenticated
using (
    public.is_elevated_project_member(project_id)
    and role <> 'owner'
)
with check (
    public.is_elevated_project_member(project_id)
    and role <> 'owner'
);

-- DELETE deliberately does NOT also filter by role/active-tasks here,
-- even though INSERT/UPDATE filter out 'owner': RLS's DELETE side is
-- USING-only (no WITH CHECK, no "new row"), and a USING-clause failure is
-- SILENT -- it just excludes the row from the delete, no error, "0 rows
-- affected". If this policy also excluded the owner's row or rows with
-- active tasks, block_owner_removal_from_project_members() and
-- block_project_member_removal_with_active_tasks() (both BEFORE DELETE
-- triggers) would never get a chance to fire and raise their specific,
-- actionable error messages -- a silent no-op instead of "transfer
-- ownership first" / "still has N active tasks". Leaving DELETE's USING
-- to just the elevated-tier-or-self check keeps the row a legitimate
-- delete target so the guard triggers do their job.
--
-- The self-removal half (employee_id = current_employee_id()) wasn't
-- explicitly requested but is cheap and standard ("leave a project you're
-- on") -- still fully subject to both guard triggers (can't self-remove
-- as owner without transferring first; can't self-remove with active
-- incomplete tasks).
create policy "Elevated members or self can remove project members" on public.project_members
for delete to authenticated
using (
    public.is_elevated_project_member(project_id)
    or employee_id = public.current_employee_id()
);
