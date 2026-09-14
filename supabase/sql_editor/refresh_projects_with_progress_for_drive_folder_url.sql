-- Run once in the Supabase SQL editor, AFTER projects_add_drive_folder_url.sql.
--
-- Root cause of "drive_folder_url saves fine but always reads back
-- empty": Postgres expands `select p.*` into the CONCRETE column list
-- `projects` had at the moment the view was CREATEd -- it is not
-- re-expanded on every query. projects_with_progress (projects_tasks_views.sql)
-- was created before drive_folder_url existed, so every read through it
-- (useProject.js -- the only path the Edit Project form and
-- ProjectDetailLayout's "Open Shared Drive" button read from) silently
-- omitted the column entirely, even though updateProject() (a plain
-- `.from("projects").update(...)` against the base table, not the view)
-- was writing it correctly the whole time.
--
-- `create or replace view` can't fix this here -- it only allows
-- APPENDING new columns at the very end of the view's own output list,
-- and drive_folder_url's position (wherever ALTER TABLE happened to add
-- it in `projects`) lands before pp.total_task_count/etc. in `p.*`'s
-- expansion, which would rename an existing output column and Postgres
-- rejects that outright. Drop and recreate instead -- safe here, nothing
-- else has a hard catalog dependency on this view (only a plpgsql
-- function's *body* text references it in employee_lifecycle_cases_views.sql's
-- own comment, which isn't a real dependency Postgres tracks).
--
-- Same view definition as projects_tasks_views.sql, verbatim -- this file
-- exists only to force the column list to re-expand, not to change the
-- view's logic. Any FUTURE `alter table projects add column ...` needs
-- this same drop+recreate step repeated, not just the ALTER TABLE alone.
drop view if exists public.projects_with_progress;

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
