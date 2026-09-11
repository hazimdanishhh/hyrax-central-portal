-- Run once in the Supabase SQL editor. Adds the cooldown/one-shot dedup
-- columns project.deadline_approaching/project.overdue need -- see
-- check_project_deadlines_approaching.sql / check_projects_overdue.sql.
--
-- Both live on projects itself (not a per-member table) because the
-- dedup unit for these two events is "has this project's approaching/
-- overdue reminder already gone out," not a per-recipient fact -- the
-- audience (all current project_members) is resolved fresh every scan,
-- not tied to when a specific member joined. Contrast with
-- task_assignees_add_reminder_columns.sql, where the dedup unit genuinely
-- is a per-recipient pair.
alter table public.projects
    add column if not exists deadline_reminder_sent_at timestamptz,
    add column if not exists overdue_last_notified_at timestamptz;
