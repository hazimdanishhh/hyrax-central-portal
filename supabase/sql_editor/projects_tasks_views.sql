-- WITH (security_invoker = true) on ALL THREE views is not optional.
--
-- Postgres views default to running with the VIEW OWNER's privileges, not
-- the querying session's -- the legacy security_invoker = false default.
-- In Supabase, a view created here is owned by a role that also owns the
-- underlying tables and typically carries BYPASSRLS. Without
-- security_invoker = true, every view below would silently show every
-- project's data to every authenticated user regardless of membership --
-- a direct violation of req #6 -- even though projects/tasks/
-- project_members themselves have correct RLS. (The existing
-- employees_public_view.sql precedent has no such clause -- plausibly
-- fine there as an intentionally-open directory, but not a pattern to
-- copy here, where confidentiality is an explicit requirement.)
--
-- This does NOT propagate through a chain of views -- projects_with_progress
-- is built on project_progress, so both need the clause independently,
-- set on each one individually below.

create view public.project_progress
with (security_invoker = true)
as
select
    p.id as project_id,
    count(t.id) as total_task_count,
    count(t.id) filter (where t.status = 'CANCELLED') as cancelled_task_count,
    -- "active" = counts toward req #9's denominator (total minus
    -- cancelled) -- not to be confused with task_status's own
    -- IN_PROGRESS value.
    count(t.id) filter (where t.status <> 'CANCELLED') as active_task_count,
    count(t.id) filter (where t.status = 'COMPLETED') as completed_task_count,
    case
        when count(t.id) filter (where t.status <> 'CANCELLED') = 0 then null
        else round(
            100.0 * count(t.id) filter (where t.status = 'COMPLETED')
            / count(t.id) filter (where t.status <> 'CANCELLED')
        )
    end as progress_percentage
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;

comment on view public.project_progress is
    'Per-project completed/total-non-cancelled progress %, req #9. NULL (not 0) progress_percentage means zero non-cancelled tasks exist yet.';

-- The practical one-shot read model for a Projects list page -- PostgREST
-- can't auto-embed project_progress into a projects .select() (views have
-- no FK for it to detect), so this is what the frontend queries instead
-- of two round-trips joined client-side. Inner join, not left --
-- project_progress always has exactly one row per project by construction.
create view public.projects_with_progress
with (security_invoker = true)
as
select
    p.*,
    pp.total_task_count,
    pp.cancelled_task_count,
    pp.active_task_count,
    pp.completed_task_count,
    pp.progress_percentage
from public.projects p
join public.project_progress pp on pp.project_id = p.id;

-- Live-derived, not a stored table -- always in sync, no trigger burden,
-- appropriate at this app's scale. Keys off employees.department_id per
-- req #2's explicit wording, not profiles.department_id.
create view public.project_departments
with (security_invoker = true)
as
select distinct
    pm.project_id,
    e.department_id,
    d.name as department_name,
    d.sub as department_sub
from public.project_members pm
join public.employees e on e.id = pm.employee_id
join public.departments d on d.id = e.department_id
where e.department_id is not null;
