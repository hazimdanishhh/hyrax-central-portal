-- arguments: none
-- returns: json
--
-- Backs the Projects list page's OverviewCards. Kept at exactly 4 tiles by
-- explicit product decision (2026-09) -- Total, Active, Overdue, Due Soon.
-- planningCount/onHoldCount were dropped from this KPI row to make room
-- for the due-date-aware pair (still fully recoverable via the list's own
-- status filter, just no longer a top-row tile).
--
-- overdueCount/dueSoonCount use target_end_date -- the SAME 3-day window
-- and terminal-status exclusion as get_my_tasks_overview_rpc.sql's own
-- due_date-based rule, and the same rule project.deadline_approaching/
-- project.overdue notifications and the dueStatus filter already added to
-- fetchProjects (projectsService.js) use -- one definition of "due soon"
-- for this app, applied a 3rd time here, not reinvented.
--
-- No SECURITY DEFINER -- relies on projects' own RLS, same as before.
create or replace function public.get_projects_overview()
returns json
language plpgsql
as $$
declare
    result json;
    v_today date := current_date;
    v_due_soon_cutoff date := current_date + 3;
begin
    select json_build_object(
        'totalCount', count(*),
        'activeCount', count(*) filter (where status = 'ACTIVE'),
        'overdueCount', count(*) filter (
            where target_end_date < v_today and status not in ('COMPLETED', 'CANCELLED')
        ),
        'dueSoonCount', count(*) filter (
            where target_end_date >= v_today and target_end_date <= v_due_soon_cutoff
            and status not in ('COMPLETED', 'CANCELLED')
        )
    )
    into result
    from public.projects;

    return result;
end;
$$;
