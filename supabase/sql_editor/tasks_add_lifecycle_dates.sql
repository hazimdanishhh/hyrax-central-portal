-- Run once in the Supabase SQL editor.
--
-- Adds tasks.start_date/completed_date (mirrors projects.start_date's
-- shape: plain nullable `date`, no default). Both are populated
-- automatically by auto_set_task_lifecycle_dates() (see
-- supabase/functions/auto_set_task_lifecycle_dates.sql) the first time a
-- task reaches IN_PROGRESS/COMPLETED, but remain normal editable columns --
-- a user can still backdate/pre-plan either one manually via the task
-- edit form.
alter table public.tasks
    add column if not exists start_date date,
    add column if not exists completed_date date;

-- Deliberately narrower than projects_dates_sane (start_date vs
-- target_end_date): does NOT constrain due_date here. A task can
-- legitimately be started (start_date = today, via the auto-set trigger)
-- AFTER its own due_date has already passed -- that's just "started late",
-- not invalid data -- so a `due_date >= start_date` check would actively
-- break the Start quick-action on any already-overdue task. completed_date
-- vs start_date has no such conflict: both are only ever auto-stamped with
-- current_date at the moment of a genuine transition, so a normal
-- Start-then-Complete (or Start-then-Complete-then-Revert) sequence can
-- never trip this check -- only a manual, nonsensical backdate can, which
-- is exactly what this constraint exists to catch.
alter table public.tasks
    add constraint tasks_dates_sane check (
        completed_date is null or start_date is null or completed_date >= start_date
    );
