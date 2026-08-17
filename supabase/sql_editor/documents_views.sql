-- WITH (security_invoker = true) is not optional -- see
-- projects_tasks_views.sql's header comment for the full rationale.
-- Without it this view would show every project's documents to every
-- authenticated user regardless of documents/projects RLS.
--
-- Project-scoped document library read model, backing the Project Detail
-- Documents tab and the cross-project Workspace Documents page --
-- flattens project/uploader names and aggregates the set of tasks (if
-- any) each document is currently linked to via task_documents, so a
-- listing page can show "linked to: Task A, Task B" without an N+1 query
-- per document. LEFT JOIN LATERAL is required, not a plain LEFT JOIN +
-- GROUP BY: the per-document aggregation needs to run against a value
-- (d.id) from the OUTER row, which only LATERAL allows inside a
-- FROM-clause subquery.
create view public.documents_with_context
with (security_invoker = true)
as
select
    d.id,
    d.project_id,
    p.name as project_name,
    d.drive_file_id,
    d.name,
    d.url,
    d.mime_type,
    d.icon_url,
    d.attached_by,
    e.full_name as attached_by_name,
    d.attached_at,
    coalesce(lt.linked_task_ids, '{}') as linked_task_ids,
    coalesce(lt.linked_task_titles, '{}') as linked_task_titles,
    lt.linked_task_count
from public.documents d
join public.projects p on p.id = d.project_id
left join public.employees e on e.id = d.attached_by
left join lateral (
    select
        array_agg(t.id order by t.created_at) as linked_task_ids,
        array_agg(t.title order by t.created_at) as linked_task_titles,
        count(*) as linked_task_count
    from public.task_documents td
    join public.tasks t on t.id = td.task_id
    where td.document_id = d.id
) lt on true;

comment on view public.documents_with_context is
    'Project-scoped document library listing, with aggregated linked-task ids/titles so a page can show "linked to: Task A, Task B" without an N+1 query per document. security_invoker=true is load-bearing -- without it this view would leak every project''s documents to every authenticated user regardless of documents/projects/task_documents RLS.';
