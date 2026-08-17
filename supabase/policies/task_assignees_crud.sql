-- SELECT: "is the CALLER a member of this task's project" (can they act
-- at all) is a DIFFERENT question from "is the TARGET employee_id a
-- member" (req #5's actual integrity rule, checked by
-- enforce_task_assignee_is_project_member()'s trigger regardless of RLS
-- outcome) -- both checks matter, not duplicating each other.
--
-- INSERT gates BOTH the caller (must be a working member -- excludes cc)
-- AND the target employee_id being assigned (must ALSO resolve to a
-- working-member role -- excludes cc and non-members). Enforced twice,
-- deliberately: here at the RLS layer, and again in the trigger, which
-- fires regardless of RLS and gives a friendlier, specific error message.
--
-- DELETE: working members only (owner/lead/member) -- unassigning someone
-- from a task is a task-management action, not mere viewing, so a
-- view-only cc shouldn't be able to do it either.
create policy "Superadmin CRUD" on public.task_assignees
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

create policy "Project members can view task assignees" on public.task_assignees
for select to authenticated
using (public.is_project_member((select project_id from public.tasks where id = task_id)));

create policy "Working members can assign tasks" on public.task_assignees
for insert to authenticated
with check (
    public.is_working_project_member((select t.project_id from public.tasks t where t.id = task_assignees.task_id))
    and public.project_member_role(
        (select t.project_id from public.tasks t where t.id = task_assignees.task_id),
        employee_id
    ) in ('owner', 'lead', 'member')
);

create policy "Working members can unassign tasks" on public.task_assignees
for delete to authenticated
using (public.is_working_project_member((select t.project_id from public.tasks t where t.id = task_assignees.task_id)));
