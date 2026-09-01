-- WITH (security_invoker = true) is not optional -- same pitfall as
-- projects_with_progress: without it, this view would run with the view
-- owner's privileges (typically BYPASSRLS in Supabase), silently showing
-- every case's data to every authenticated user regardless of RLS on the
-- base tables. Does not propagate through a view chain, but there's only
-- one view here so that's moot.
--
-- "Complete" here mirrors employee_lifecycle_case_items' own DONE/SKIPPED
-- definition exactly (see check_lifecycle_case_completion.sql) -- this view
-- is a read-only progress summary, not a second source of truth for
-- whether a case is actually done; the trigger owns that decision.
create view public.employee_lifecycle_cases_with_progress
with (security_invoker = true)
as
select
    c.*,
    count(i.id) as total_item_count,
    count(i.id) filter (where i.status = 'SKIPPED') as skipped_item_count,
    count(i.id) filter (where i.status in ('DONE', 'SKIPPED')) as completed_item_count,
    case
        when count(i.id) = 0 then null
        else round(100.0 * count(i.id) filter (where i.status in ('DONE', 'SKIPPED')) / count(i.id))
    end as progress_percentage
from public.employee_lifecycle_cases c
left join public.employee_lifecycle_case_items i on i.case_id = c.id
group by c.id;

comment on view public.employee_lifecycle_cases_with_progress is
    'Per-case completed(DONE+SKIPPED)/total item progress %, backing CaseCard/ProgressBar/OverviewCards KPIs. NULL progress_percentage means the case has no seeded items yet (should not happen in practice -- get_or_create_*_case() always seeds the full fixed set atomically).';
