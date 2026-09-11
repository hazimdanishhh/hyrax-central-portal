-- Run once in the Supabase SQL editor. Adds the cooldown/one-shot dedup
-- columns task.due_soon/task.overdue need -- see check_tasks_due_soon.sql /
-- check_tasks_overdue.sql.
--
-- Live on task_assignees itself, not tasks -- a task can have MULTIPLE
-- assignees (this is a many-to-many junction), and assignees can be added
-- or removed independently of each other, so the dedup unit genuinely is
-- the (task_id, employee_id) pair, which this table's own composite PK
-- already is. A single column on tasks would either re-notify everyone
-- every time one new assignee joins, or never notify a newly-added
-- assignee at all -- neither is correct.
alter table public.task_assignees
    add column if not exists due_soon_reminder_sent_at timestamptz,
    add column if not exists overdue_last_notified_at timestamptz;
