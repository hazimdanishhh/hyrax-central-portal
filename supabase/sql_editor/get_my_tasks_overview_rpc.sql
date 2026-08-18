-- Run this once in the Supabase SQL editor.
--
-- KPI counts for the My Tasks list page's OverviewCards -- same plain
-- (NOT security definer) shape as get_projects_overview_rpc.sql. Resolves
-- the caller's own identity via the existing current_employee_id() helper
-- rather than taking a p_employee_id parameter -- simpler, and removes any
-- doubt about whether a caller could pass someone else's id. tasks' own
-- RLS (project-membership-scoped) still applies; the exists() clause
-- narrows further to "assigned to me", the same restriction fetchMyTasks()
-- already applies client-side via task_assignees!inner.
--
-- "Due soon" = due_date within the next 3 days -- reuses the exact figure
-- already named for the not-yet-built task.due_soon notification event
-- (docs/NOTIFICATION-RULES-TRACKER.csv), so this app has one definition of
-- "due soon" for tasks, not two.
create or replace function public.get_my_tasks_overview()
returns json
language plpgsql
as $$
declare
    result json;
    v_employee_id uuid := public.current_employee_id();
    v_today date := current_date;
    v_due_soon_cutoff date := current_date + 3;
begin
    select json_build_object(
        'totalCount', count(*),
        'overdueCount', count(*) filter (
            where due_date < v_today and status not in ('COMPLETED', 'CANCELLED')
        ),
        'dueSoonCount', count(*) filter (
            where due_date >= v_today and due_date <= v_due_soon_cutoff
            and status not in ('COMPLETED', 'CANCELLED')
        ),
        'completedCount', count(*) filter (where status = 'COMPLETED')
    )
    into result
    from public.tasks t
    where exists (
        select 1 from public.task_assignees ta
        where ta.task_id = t.id and ta.employee_id = v_employee_id
    );

    return result;
end;
$$;
