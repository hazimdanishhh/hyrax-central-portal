-- Run this once in the Supabase SQL editor.
--
-- KPI counts for the Projects list page's OverviewCards -- plain function
-- (NOT security definer), so it runs with the caller's own row-security
-- context: projects' existing "Members can view their projects" RLS policy
-- already scopes every count below to the caller's own projects, same as
-- fetchProjects() gets automatically today. Mirrors the shape of every
-- other dashboard RPC in this app (e.g. get_sales_leads_dashboard) --
-- one round trip, count(*) filter (where ...) per KPI, returns json.
create or replace function public.get_projects_overview()
returns json
language plpgsql
as $$
declare
    result json;
begin
    select json_build_object(
        'totalCount', count(*),
        'activeCount', count(*) filter (where status = 'ACTIVE'),
        'planningCount', count(*) filter (where status = 'PLANNING'),
        'onHoldCount', count(*) filter (where status = 'ON_HOLD')
    )
    into result
    from public.projects;

    return result;
end;
$$;
