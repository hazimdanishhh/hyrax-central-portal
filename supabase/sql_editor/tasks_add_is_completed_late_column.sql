-- Run once in the Supabase SQL editor.
--
-- Backs the "Completed Late" filter on My Tasks and the per-project Tasks
-- tab, and the per-project Overview tab's "Completed Late" KPI tile
-- (get_project_overview_rpc.sql).
--
-- A STORED GENERATED column, not a plain filter clause, because "was this
-- task completed after its own due date" is a comparison between two
-- COLUMNS on the same row (completed_date > due_date) -- unlike
-- overdue/due_soon (a column compared against current_date, a single
-- literal, which PostgREST's standard `column=operator.value` filter
-- syntax already handles fine), PostgREST has no operator for comparing
-- one column to another directly. Materializing the comparison as a real
-- column sidesteps that limitation entirely: `.eq("is_completed_late",
-- true)` is then just an ordinary column filter, and it's also
-- automatically included in any `select("*")` (tasksByProjectService.js,
-- myTasksService.js both already select "*"), so the client-side
-- ProjectTasksTab filter can read it directly too, rather than
-- reimplementing the same comparison a second time in JS.
--
-- Deliberately requires BOTH dates non-null and status = 'COMPLETED' --
-- a task with no due_date was never "late" against anything, and an
-- in-progress task isn't "late," it's just overdue (a different, already
---covered signal).
alter table public.tasks
    add column if not exists is_completed_late boolean
    generated always as (
        status = 'COMPLETED'
        and due_date is not null
        and completed_date is not null
        and completed_date > due_date
    ) stored;

-- Partial index -- this filter only ever looks for `= true`, never `= false`.
create index if not exists tasks_is_completed_late_idx
    on public.tasks (project_id)
    where is_completed_late;
