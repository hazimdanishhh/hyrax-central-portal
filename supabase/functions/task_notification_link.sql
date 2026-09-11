-- arguments: p_task_id uuid, p_project_id uuid, p_employee_id uuid
-- returns: text
--
-- Resolves the correct notification link for THIS SPECIFIC recipient,
-- not a static per-event choice -- checks whether p_employee_id is
-- currently a task_assignees row for p_task_id. If yes: the task is
-- genuinely part of their own assigned work, so /app/workspace/tasks/:id
-- (My Tasks -- MyTasks.jsx's own URL-driven sidebar) is the correct,
-- personally-framed destination. If no (a removed assignee, a task-CC'd
-- observer, an owner/lead who commented but isn't assigned, etc.):
-- /app/workspace/projects/:projectId/tasks/:id (the Project Tasks tab --
-- the module's "every task, any role, per req #6" view) is correct
-- instead, since My Tasks' own list is assignee-filtered server-side and
-- would never show them this task in its proper context.
--
-- One shared check instead of a per-event static choice: several events
-- already mix both audiences in the SAME emit (task.status_changed/
-- document.attached widen to include task-CC'd users once that feature
-- ships, per docs/TASK-CC-DESIGN.md; task.comment_added is designed as
-- assignees UNION task-ccs UNION owner/lead from day one) -- computing
-- this once per recipient, here, means none of those call sites (present
-- or future) need their own branching logic.
--
-- SECURITY DEFINER + set search_path = '': called from within other
-- SECURITY DEFINER notify_*/check_* functions resolving OTHER users'
-- links, same hardening reasoning as every other helper in this system.
create or replace function public.task_notification_link(
    p_task_id uuid,
    p_project_id uuid,
    p_employee_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when exists (
            select 1 from public.task_assignees
            where task_id = p_task_id and employee_id = p_employee_id
        )
        then '/app/workspace/tasks/' || p_task_id
        else '/app/workspace/projects/' || p_project_id || '/tasks/' || p_task_id
    end;
$$;
