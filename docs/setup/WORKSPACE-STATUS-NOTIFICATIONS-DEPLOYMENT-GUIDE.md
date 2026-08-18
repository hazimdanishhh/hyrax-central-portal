# Workspace Status Notifications — Deployment Guide

Exact, ordered steps to deploy the three Workspace notifications added for UAT (2026-08) and
tracked in [`docs/NOTIFICATION-RULES-TRACKER.csv`](../NOTIFICATION-RULES-TRACKER.csv):
`document.attached`, `project.status_changed`, `task.status_changed`. See
[`docs/PROJECTS-TASKS-ARCHITECTURE.md`](../PROJECTS-TASKS-ARCHITECTURE.md)'s Notifications
section for why these three needed a different shape (loop-and-emit-per-recipient) than
`task.assigned`/`project.member_added`. Follow in order.

## 0. Prerequisite (should already be done)

- [ ] The core notification system from [`NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./NOTIFICATIONS-DEPLOYMENT-GUIDE.md) must already be deployed — all three of these reuse `emit_notification_event`, `fan_out_notification_event`, and `notification_rules.target_payload_keys` unchanged.
- [ ] The core Projects & Tasks schema/functions must already be deployed (`projects`, `tasks`, `task_assignees`, `project_members`, `documents`, `task_documents`, `current_employee_id()`), since all three new trigger functions query these directly.

## 1. The 3 new trigger functions

Order doesn't matter between these — run all three:

- [ ] Run **`supabase/functions/notify_document_attached.sql`**
- [ ] Run **`supabase/functions/notify_project_status_changed.sql`**
- [ ] Run **`supabase/functions/notify_task_status_changed.sql`**

## 2. The 3 new triggers

- [ ] Run **`supabase/triggers/trg_notify_document_attached.sql`** (`AFTER INSERT ON public.task_documents`)
- [ ] Run **`supabase/triggers/trg_notify_project_status_changed.sql`** (`AFTER UPDATE ON public.projects`)
- [ ] Run **`supabase/triggers/trg_notify_task_status_changed.sql`** (`AFTER UPDATE ON public.tasks`)

## 3. Seed the notification rules

- [ ] Run **`supabase/sql_editor/seed_workspace_status_notification_rules.sql`** — inserts all three rules (`document.attached`, `project.status_changed`, `task.status_changed`) in one file, all `in_app+email`, all with `condition = '{}'::jsonb` and `target_payload_keys = array['recipient_profile_id']`.

As always, these are data rows, not code — but note the caveat from the seed file's own
comment: unlike `task.assigned`/`project.member_added`, the _recipient set_ here (a task's
assignees, a project's members) is a SQL query inside the trigger function, not
`target_roles`/`target_departments` on the rule row. Editing the rule row can still change
channels or pause the event (`is_active = false`), but changing **who** gets notified means
editing the trigger function itself.

**Checkpoint: all three notifications are now live end to end.**

## Verifying it all worked

**`document.attached`**:

- [ ] As one test employee, link an existing project document to a task that has a
      _different_ employee as an assignee (via the task's Documents field in its sidebar).
- [ ] Confirm the other assignee (not the actor) gets a `notifications` row and an
      `email_queue` row.
- [ ] Confirm attaching a document at the project level instead (`ProjectDocumentsTab`'s
      "Attach Document" button, no task involved) does **not** fire any notification — it
      only writes to `documents`, never `task_documents`, so `trg_notify_document_attached`
      never runs.

**`project.status_changed`**:

- [ ] Pick (or set up) a project with 2+ members across different roles — an owner, a plain
      member, and a `cc`.
- [ ] Change the project's status (Edit Project, or the "Mark as Completed" nudge).
- [ ] Confirm every member except the actor gets notified, **including the `cc` member**.
- [ ] Confirm `link_to` opens `/app/workspace/projects/<id>/tasks` correctly.
- [ ] Update the project again with no actual status change (e.g. edit only the
      description) — confirm **no** notification fires (the trigger guards on
      `old.status IS DISTINCT FROM new.status`).

**`task.status_changed`**:

- [ ] Pick a task with 2+ assignees.
- [ ] As one assignee, use the Start button (TO_DO → IN_PROGRESS). Confirm the other
      assignee(s) get notified, actor excluded.
- [ ] Repeat for Complete (IN_PROGRESS → COMPLETED) and Cancel (→ CANCELLED) — confirm both
      also notify correctly, including the Cancel case.

**Email dispatch (all three)**:

- [ ] After a few minutes, check `email_queue`/`email_log` to confirm the `pg_cron`-scheduled
      sender actually dispatched the rows queued above, not just that they were queued.

## Not part of this guide — verify only

A fourth notification asked about for the same UAT round, `lead.stage_changed` (Sales
module, PROPOSAL→NEGOTIATION), required **no new code** — it was already implemented and its
existing seeded rule (`new_stage IN ('NEGOTIATION','WON')`, targeting `roles: manager` +
`departments: SAL`) already fires for exactly this transition, since `NEGOTIATION` is only
ever reached from `PROPOSAL`. Confirm it during the Sales UAT by moving a real lead from
PROPOSAL to NEGOTIATION and checking a Sales manager gets notified — no deployment steps
needed here.
