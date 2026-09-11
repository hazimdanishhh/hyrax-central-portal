# Workspace Lifecycle Notifications — Deployment Guide

Exact, ordered steps to deploy the 11 new Workspace notifications from the full-lifecycle
notification pass, tracked in
[`docs/NOTIFICATION-RULES-TRACKER.csv`](../NOTIFICATION-RULES-TRACKER.csv):
`project.member_removed`, `project.member_role_changed`, `project.ownership_transferred`,
`project.deadline_approaching`, `project.overdue`, `task.unassigned`, `task.due_date_changed`,
`task.due_soon`, `task.overdue`, `task.deleted`, `document.removed` — plus the follow-up
per-recipient link fix (`task_notification_link()`) and the `ProjectTasksTab.jsx` deep-linking
refactor that came out of reviewing this pass's own notification-link matrix. See
[`docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md`](../WORKSPACE-NOTIFICATIONS-LIFECYCLE.md) for the
full lifecycle map these fit into, and
[`WORKSPACE-STATUS-NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./WORKSPACE-STATUS-NOTIFICATIONS-DEPLOYMENT-GUIDE.md)
for the five events that shipped before this pass. Follow in order.

## 0. Prerequisites (should already be done)

- [ ] The core notification system ([`NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./NOTIFICATIONS-DEPLOYMENT-GUIDE.md)) and the core Projects & Tasks schema/functions must already be deployed.
- [ ] The five original Workspace events ([`WORKSPACE-STATUS-NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./WORKSPACE-STATUS-NOTIFICATIONS-DEPLOYMENT-GUIDE.md)) should already be live — this pass also patches those five functions in place (step 7 below).

## 1. New columns

Order doesn't matter between these two:

- [ ] Run **`supabase/sql_editor/projects_add_deadline_reminder_columns.sql`** (`deadline_reminder_sent_at`, `overdue_last_notified_at` on `projects`)
- [ ] Run **`supabase/sql_editor/task_assignees_add_reminder_columns.sql`** (`due_soon_reminder_sent_at`, `overdue_last_notified_at` on `task_assignees`)

## 2. Silent cooldown-reset trigger

Deploy before any scan below goes live, so a deadline never scans stale:

- [ ] Run **`supabase/functions/reset_project_deadline_reminder_cooldowns.sql`**
- [ ] Run **`supabase/triggers/trg_reset_project_deadline_reminder_cooldowns.sql`** (`BEFORE UPDATE OF target_end_date ON public.projects`)

## 3. Shared link helper

Deploy before any function below that calls it (steps 4, 6, 7, 8 all reference it):

- [ ] Run **`supabase/functions/task_notification_link.sql`** — resolves, per recipient, whether a task-notification's `link_to` should point at My Tasks (`/app/workspace/tasks/:id`, if that recipient is currently a `task_assignees` row) or the Project Tasks tab (`/app/workspace/projects/:projectId/tasks/:id`, otherwise). Requires no schema of its own.

## 4. Simple change-triggered events (no new columns)

Order doesn't matter between these:

- [ ] Run **`supabase/functions/notify_document_removed.sql`** + **`supabase/triggers/trg_notify_document_removed.sql`** (`BEFORE DELETE ON public.documents`)
- [ ] Run **`supabase/functions/notify_project_member_removed.sql`** + **`supabase/triggers/trg_notify_project_member_removed.sql`** (`AFTER DELETE ON public.project_members`)
- [ ] Run **`supabase/functions/notify_task_unassigned.sql`** + **`supabase/triggers/trg_notify_task_unassigned.sql`** (`AFTER DELETE ON public.task_assignees`) — uses the step-3 helper
- [ ] Re-run **`supabase/functions/transfer_project_ownership.sql`** (`create or replace` — now also emits `project.ownership_transferred` directly from its own body after the final owner-count check)

## 5. Role-change event

- [ ] Run **`supabase/functions/notify_project_member_role_changed.sql`** + **`supabase/triggers/trg_notify_project_member_role_changed.sql`** (`AFTER UPDATE OF role ON public.project_members`)

**Verify before moving on**: this trigger must never double-fire alongside step 4's ownership-transfer emit. Transfer ownership on a test project and confirm the demoted former owner and the newly-promoted owner do **not** get a `project.member_role_changed` notification — only the single `project.ownership_transferred` one.

## 6. Due-date-changed event

Depends on step 1's `task_assignees` columns and step 3's helper:

- [ ] Run **`supabase/functions/notify_task_due_date_changed.sql`** + **`supabase/triggers/trg_notify_task_due_date_changed.sql`** (`AFTER UPDATE OF due_date ON public.tasks`)

## 7. RLS-gap fix + link fix on the five original Workspace functions

Re-run these five (`create or replace`, no trigger changes needed, the bindings already exist).
All five gain the `security definer set search_path=''` RLS-gap fix; three of them
(`notify_task_assigned`, `notify_task_status_changed`, `notify_document_attached`) also switch
their `link_to` to the step-3 helper, so run this **after** step 3:

- [ ] Re-run **`supabase/functions/notify_task_assigned.sql`**
- [ ] Re-run **`supabase/functions/notify_project_member_added.sql`**
- [ ] Re-run **`supabase/functions/notify_task_status_changed.sql`**
- [ ] Re-run **`supabase/functions/notify_project_status_changed.sql`**
- [ ] Re-run **`supabase/functions/notify_document_attached.sql`**

## 8. Scheduled-scan functions

Depend on steps 1, 2, 3, and 6:

- [ ] Run **`supabase/functions/check_project_deadlines_approaching.sql`**
- [ ] Run **`supabase/functions/check_projects_overdue.sql`**
- [ ] Run **`supabase/functions/check_tasks_due_soon.sql`** — uses the step-3 helper
- [ ] Run **`supabase/functions/check_tasks_overdue.sql`** — uses the step-3 helper

## 9. Task-deleted event

Independent, any time after step 1:

- [ ] Run **`supabase/functions/notify_task_deleted.sql`** + **`supabase/triggers/trg_notify_task_deleted.sql`** (`BEFORE DELETE ON public.tasks`)

## 10. Seed the notification rules

- [ ] Run **`supabase/sql_editor/seed_project_lifecycle_notification_rules.sql`** (`project.member_removed`, `project.member_role_changed`, `project.ownership_transferred`, `project.deadline_approaching`, `project.overdue`)
- [ ] Run **`supabase/sql_editor/seed_task_lifecycle_notification_rules.sql`** (`task.unassigned`, `task.due_date_changed`, `task.due_soon`, `task.overdue`, `task.deleted`)
- [ ] Run **`supabase/sql_editor/seed_document_removed_notification_rule.sql`** (`document.removed`)

## 11. Schedule the cron job

- [ ] Run **`supabase/sql_editor/schedule_check_workspace_lifecycle_cron.sql`** — new job `check-workspace-lifecycle-daily`, bundling all four `check_*` functions from step 8, separate from `check-employee-lifecycle-daily`.

## 12. Frontend

No SQL — ships via the normal build/deploy pipeline, no ordering dependency on steps 1–11:

- [ ] `src/routes/WorkspaceRoutes.jsx` — adds the nested `:taskId` route under the project's `tasks` tab.
- [ ] `src/pages/user/workspace/projects/detail/tasks/ProjectTasksTab.jsx` — URL-driven task sidebar (mirrors `MyTasks.jsx`), so a `link_to` pointing at the Project Tasks tab actually opens the right task.

**Checkpoint: all 11 notifications are now live end to end, every task-notification link routes each recipient to the correct page, and the five original Workspace notifications no longer silently drop recipients outside HR/superadmin/direct-manager.**

## Verifying it all worked

**`project.member_removed` / `task.unassigned`**: remove a member/assignee (not yourself) and confirm they're notified; remove yourself and confirm you are **not**.

**`project.member_role_changed`**: change another member's role tier (e.g. member → lead) and confirm they're notified; confirm changing your own role does **not** notify you; confirm an ownership transfer does **not** also fire this event (see step 5's checkpoint).

**`project.ownership_transferred`**: transfer ownership and confirm only the new owner is notified.

**`project.deadline_approaching` / `project.overdue`**: set a test project's `target_end_date` to 2 days out (or in the past, respectively) with status not `COMPLETED`/`CANCELLED`, then manually run `select public.check_project_deadlines_approaching();` (or `check_projects_overdue()`) — confirm every current member (including a `cc`) gets notified, and running the same function again does **not** re-notify. Then reschedule `target_end_date` and confirm the cooldown resets (a third manual run notifies again).

**`task.due_date_changed` / `task.due_soon` / `task.overdue`**: reschedule a task's due date and confirm current assignees are notified (excluding the actor); set a due date 2 days out and manually run `select public.check_tasks_due_soon();` — confirm each assignee is notified once and not again on a second run; repeat for `check_tasks_overdue()` with a past due date.

**`task.deleted`**: delete a task with 2+ assignees and confirm all of them (excluding the actor) are notified; confirm deleting an entire cancelled, taskless-after-cancellation project does **not** also fire a burst of `task.deleted`/`document.removed`/`project.member_removed` events for whatever it cascades through.

**`document.removed`**: as a non-uploader elevated member, remove another employee's document and confirm the uploader is notified; remove your own document and confirm you are **not**.

**RLS-gap fix**: as an ordinary "member" (not HR/superadmin/that person's manager), assign a task to another ordinary member who isn't your direct report — confirm the notification now actually lands (this silently failed before step 7).

**Per-recipient link routing (`task_notification_link()`)**: get assigned to a task and confirm the notification's `link_to` is `/app/workspace/tasks/:id` (My Tasks); then get unassigned from that same task and confirm the `task.unassigned` notification instead links to `/app/workspace/projects/:id/tasks/:id` (Project Tasks tab). Click a Project-Tasks-tab link as a project member who is NOT that task's assignee — confirm the sidebar still opens correctly (read-only, via `cannotUpdate`), and confirm a hard refresh on that URL works.

**Email dispatch (all of the above)**: after a few minutes, check `email_queue`/`email_log` to confirm the `pg_cron`-scheduled sender actually dispatched the queued rows.

## Not part of this guide

`document.added_to_project`, `task.cc_added`/`task.cc_removed`/`task.comment_added` remain
`Proposed` — the latter three are fully designed in
[`docs/TASK-CC-DESIGN.md`](../TASK-CC-DESIGN.md) and
[`docs/TASK-COMMENTS-DESIGN.md`](../TASK-COMMENTS-DESIGN.md) but not implemented in this pass.
