-- Run once in the Supabase SQL editor, after
-- tasks_add_lifecycle_dates.sql (same reasoning, applied to projects).
alter table public.projects
    add column if not exists completed_date date;

-- Mirrors tasks_dates_sane's shape/reasoning exactly, applied to projects'
-- own completed_date/start_date pair. Kept as its own constraint, not
-- folded into the existing projects_dates_sane (target_end_date vs
-- start_date) -- no need to touch/redefine that one.
alter table public.projects
    add constraint projects_completed_after_start check (
        completed_date is null or start_date is null or completed_date >= start_date
    );
