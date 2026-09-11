-- arguments: p_project_id uuid
-- returns: json
--
-- Backs the new per-project "Overview" tab (ProjectOverviewTab.jsx) -- the
-- first per-RECORD detail overview RPC in this app (every other
-- get_*_overview/get_*_dashboard RPC is list/portfolio-wide). Modeled on
-- get_my_tasks_overview_rpc.sql's shape (plain function, relies on RLS,
-- json_build_object + count(*) filter), parameterized by project_id
-- instead of resolving the caller's own identity, plus two json_agg
-- chart-dataset arrays -- the same "kpis object + named chart arrays"
-- envelope every populated dashboard RPC in this app already uses
-- (see get_attendance_dashboard_rpc.sql's topAbsenteeismData/
-- topOvertimeData, get_sales_reports_dashboard_rpc.sql's stageData, etc.).
--
-- overdueCount/dueSoonCount use tasks.due_date -- same 3-day window/
-- terminal-status rule as check_tasks_due_soon.sql/check_tasks_overdue.sql,
-- scoped to this one project instead of across all of them.
--
-- completedLateCount (added 2026-09, per review): a task currently
-- overdue is, by definition, NOT completed (overdueCount explicitly
-- excludes COMPLETED/CANCELLED) -- so a task that missed its deadline and
-- was THEN finished disappears from every existing signal the moment it's
-- marked done. This closes that blind spot -- a distinct, retrospective
-- "delivered, but late" fact, a quality-of-delivery signal, not an active
-- fire (the task is already done), which is why its KPI tile is capped at
-- warning, never critical, same reasoning as Due Soon's own cap. Reads
-- tasks.is_completed_late (tasks_add_is_completed_late_column.sql, a
-- STORED GENERATED column) rather than re-deriving completed_date >
-- due_date here -- one definition, reused by this RPC, the My
-- Tasks/Project Tasks "Completed Late" filter, and the client-side
-- ProjectTasksTab filter alike.
--
-- taskStatusData feeds the "Task Breakdown" donut chart (PieChartRenderer,
-- semantic mode against chartColors.js's TASK_STATUS_COLORS).
--
-- memberPerformanceData feeds the "Team Performance" grouped-bar chart
-- (HorizontalMultiBarRenderer) -- one row per employee who has at least
-- one task assigned in this project, ordered overdue_count desc then
-- assigned_count desc so whoever needs attention shows first, same
-- "actionable, who-to-follow-up-with-first" framing
-- get_attendance_dashboard_rpc.sql's topAbsenteeismData/topOvertimeData
-- already establish for their own rankings. completed_late_count is a
-- SUBSET of completed_count (every late-completed task is also counted
-- there), not a fifth mutually-exclusive bucket -- same relationship
-- overdueCount/dueSoonCount already have to the project's live task set.
--
-- Documents/member counts are plain scalar subqueries, not a second
-- aggregate joined into the outer FROM tasks -- a cross join would
-- double-count task rows. progress_percentage reuses the existing
-- project_progress view (null when the project has zero non-cancelled
-- tasks, same as everywhere else that view is read) rather than
-- recomputing it here.
--
-- No SECURITY DEFINER -- relies on tasks/documents/project_members' own
-- membership-gated RLS, same as every sibling overview RPC: a caller who
-- isn't a member of p_project_id gets empty/zero results back, not an
-- error, matching fetchProjectById's established behavior.
create or replace function public.get_project_overview(p_project_id uuid)
returns json
language plpgsql
as $$
declare
    result json;
    v_today date := current_date;
    v_due_soon_cutoff date := current_date + 3;
begin
    select json_build_object(
        'kpis', json_build_object(
            'totalTaskCount', count(*),
            'overdueCount', count(*) filter (
                where t.due_date < v_today and t.status not in ('COMPLETED', 'CANCELLED')
            ),
            'dueSoonCount', count(*) filter (
                where t.due_date >= v_today and t.due_date <= v_due_soon_cutoff
                and t.status not in ('COMPLETED', 'CANCELLED')
            ),
            'completedCount', count(*) filter (where t.status = 'COMPLETED'),
            'completedLateCount', count(*) filter (where t.is_completed_late),
            'progressPercentage', (
                select pp.progress_percentage from public.project_progress pp
                where pp.project_id = p_project_id
            ),
            'documentCount', (select count(*) from public.documents d where d.project_id = p_project_id),
            'memberCount', (select count(*) from public.project_members pm where pm.project_id = p_project_id),
            'workingMemberCount', (
                select count(*) from public.project_members pm
                where pm.project_id = p_project_id and pm.role in ('owner', 'lead', 'member')
            ),
            'ccMemberCount', (
                select count(*) from public.project_members pm
                where pm.project_id = p_project_id and pm.role = 'cc'
            )
        ),
        'taskStatusData', (
            select coalesce(json_agg(json_build_object('name', label, 'value', cnt)), '[]'::json)
            from (
                select
                    case status
                        when 'TO_DO' then 'To Do'
                        when 'IN_PROGRESS' then 'In Progress'
                        when 'COMPLETED' then 'Completed'
                        when 'CANCELLED' then 'Cancelled'
                    end as label,
                    count(*) as cnt
                from public.tasks
                where project_id = p_project_id
                group by status
            ) s
        ),
        'memberPerformanceData', (
            select coalesce(json_agg(json_build_object(
                'name', e.full_name,
                'assigned_count', x.assigned_count,
                'completed_count', x.completed_count,
                'overdue_count', x.overdue_count,
                'completed_late_count', x.completed_late_count
            ) order by x.overdue_count desc, x.assigned_count desc), '[]'::json)
            from (
                select
                    ta.employee_id,
                    count(*) as assigned_count,
                    count(*) filter (where t2.status = 'COMPLETED') as completed_count,
                    count(*) filter (
                        where t2.due_date < v_today and t2.status not in ('COMPLETED', 'CANCELLED')
                    ) as overdue_count,
                    count(*) filter (where t2.is_completed_late) as completed_late_count
                from public.task_assignees ta
                join public.tasks t2 on t2.id = ta.task_id
                where t2.project_id = p_project_id
                group by ta.employee_id
            ) x
            join public.employees e on e.id = x.employee_id
        )
    )
    into result
    from public.tasks t
    where t.project_id = p_project_id;

    return result;
end;
$$;
