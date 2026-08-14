# HR/Attendance Lifecycle Notifications — Deployment Guide

Exact, ordered steps to deploy the four notifications described in [`docs/NOTIFICATIONS-ARCHITECTURE.md`](../NOTIFICATIONS-ARCHITECTURE.md) (see "recurring reminders with a cooldown" and the roadmap section) and tracked in [`docs/NOTIFICATION-RULES-TRACKER.csv`](../NOTIFICATION-RULES-TRACKER.csv): `employee.confirmation_overdue`, `employee.confirmation_status_mismatch`, `employee.contract_action_due`, and `attendance.approval_pending`. Follow in order — later steps depend on earlier ones.

## 0. Prerequisite (should already be done)

- [ ] The core notification system from [`NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./NOTIFICATIONS-DEPLOYMENT-GUIDE.md) and the confirmation-due-soon reminder from [`EMPLOYEE-CONFIRMATION-REMINDER-DEPLOYMENT-GUIDE.md`](./EMPLOYEE-CONFIRMATION-REMINDER-DEPLOYMENT-GUIDE.md) must already be deployed — all four of these reuse `emit_notification_event`, `fan_out_notification_event`, `notification_rules.target_payload_keys`, and (for the two employee-table ones) the same daily cron job the confirmation reminder already runs on.

## 1. Schema — 4 new columns

- [ ] Run **`supabase/sql_editor/employees_add_confirmation_overdue_last_notified_at.sql`**
- [ ] Run **`supabase/sql_editor/employees_add_confirmation_mismatch_notified_at.sql`**
- [ ] Run **`supabase/sql_editor/employees_add_contract_action_reminder_sent_at.sql`**
- [ ] Run **`supabase/sql_editor/attendance_activities_add_last_reminder_sent_at.sql`**

All four are plain `alter table ... add column if not exists`, safe to re-run.

## 2. The 4 new scan functions

Order doesn't matter between these — run all four:

- [ ] Run **`supabase/functions/check_employee_confirmations_overdue.sql`**
- [ ] Run **`supabase/functions/check_employee_confirmation_status_mismatches.sql`**
- [ ] Run **`supabase/functions/check_employee_contract_actions_due.sql`**
- [ ] Run **`supabase/functions/check_attendance_approvals_pending.sql`**

## 3. Seed the 4 notification rules

- [ ] Run **`supabase/sql_editor/seed_employee_confirmation_overdue_notification_rule.sql`**
- [ ] Run **`supabase/sql_editor/seed_employee_confirmation_mismatch_notification_rule.sql`**
- [ ] Run **`supabase/sql_editor/seed_employee_contract_action_due_notification_rule.sql`**
- [ ] Run **`supabase/sql_editor/seed_attendance_approval_pending_notification_rule.sql`**

As always, these are data rows, not code — edit `target_roles`/`target_departments`/`target_payload_keys` directly later if the real recipients should differ, no function changes needed.

## 3a. Pause `employee.confirmation_status_mismatch`

- [ ] Run **`supabase/sql_editor/pause_confirmation_status_mismatch_rule.sql`** immediately after seeding it in step 3.

Most migrated active employees have no `confirmation_date` at all — enabling this one-shot check today would flood HR with false positives and permanently burn each employee's single notification opportunity on migration noise, not a real process gap. This sets `is_active = false` on the rule; combined with step 4 not calling the function from cron, this fully pauses it without deleting anything. Re-enable later (once the historical data gap is fixed) by flipping `is_active` back to `true` and re-adding the function call to the cron job.

## 4. Update the cron schedule

**Important — this step changes an existing job, it doesn't just add a new one.** The original `schedule_check_employee_confirmations_cron.sql` only ever scheduled `check_employee_confirmations_due_soon()` under the job name `check-employee-confirmations-due-soon-daily`. Re-running `cron.schedule()` under a different name does **not** touch that old job — if it's live, unschedule it first:

- [ ] Run: `select cron.unschedule('check-employee-confirmations-due-soon-daily');` (safe to run even if it doesn't exist/was already renamed — check with the query in step 5 first if unsure).
- [ ] Run the updated **`supabase/sql_editor/schedule_check_employee_confirmations_cron.sql`** — creates a new job, `check-employee-lifecycle-daily`, that calls the three active `employees`-table functions (due-soon, overdue, contract-action-due) in one daily tick. `check_employee_confirmation_status_mismatches()` is deliberately not called (see step 3a).
- [ ] Run **`supabase/sql_editor/schedule_check_attendance_approvals_cron.sql`** — a separate new job, `check-attendance-approvals-pending-daily`, for the `attendance_activities`-table function.

**Checkpoint: all four notifications are now live end to end**, running daily. Steps below are for manual verification without waiting for real data to age into each condition.

## Verifying it all worked

- [ ] `select * from cron.job_run_details order by start_time desc limit 20;` — confirm `check-employee-lifecycle-daily` and `check-attendance-approvals-pending-daily` are both firing (and that the old `check-employee-confirmations-due-soon-daily` job is gone, not running in parallel).

**`employee.confirmation_overdue`** (recurring, 7-day cooldown):

- [ ] Pick a test employee: Probation status, `confirmation_date = null`, `join_date` more than 6 months + a few days ago (so `confirmation_due_date` is in the past), `confirmation_overdue_last_notified_at = null`.
- [ ] Run `select public.check_employee_confirmations_overdue();` — confirm a `notifications`/`email_queue` row for the manager + HR, and `confirmation_overdue_last_notified_at` is now set.
- [ ] Re-run immediately — confirm it does **not** re-notify (still within the 7-day cooldown).
- [ ] Manually set `confirmation_overdue_last_notified_at = now() - interval '8 days'`, re-run — confirm it **does** re-notify.

**`employee.confirmation_status_mismatch`** (paused — verify it stays quiet, not that it fires):

- [ ] Confirm `select is_active from public.notification_rules where event_type = 'employee.confirmation_status_mismatch';` returns `false`.
- [ ] Confirm `check_employee_confirmation_status_mismatches()` does not appear in `check-employee-lifecycle-daily`'s cron body (`select jobname, command from cron.job where jobname = 'check-employee-lifecycle-daily';`).
- [ ] If you want to sanity-check the function itself still works correctly (without it actually notifying anyone), you can call it manually — since its rule is inactive, `fan_out_notification_event` will match no rule and skip fan-out, but it will still write a `notification_events` row and set `confirmation_mismatch_notified_at` for every matching employee. **Prefer not to run it at all** until you're ready to actually re-enable it — running it now still burns the one-shot flag for false positives, same problem as before, just silently instead of noisily.

**`employee.contract_action_due`** (one-shot):

- [ ] Pick a test employee: active status, an `employment_type` that is **not** "Full-time" (e.g. Part-Time, Intern, Temporary, Contract — anything else), `end_date` within the next 30 days, `contract_action_reminder_sent_at = null`.
- [ ] Run `select public.check_employee_contract_actions_due();` — confirm a notification for the manager + HR, and `contract_action_reminder_sent_at` is now set.
- [ ] Repeat with a "Full-time" test employee under the same near-term `end_date` — confirm it does **not** fire.

**`attendance.approval_pending`** (recurring, 24-hour cooldown):

- [ ] Insert or pick a test `attendance_activities` row: `approval_status = 'Pending'`, `clocked_in_at` more than 24 hours ago, `last_reminder_sent_at = null`.
- [ ] Run `select public.check_attendance_approvals_pending();` — confirm a notification for the employee's manager + HR, and `last_reminder_sent_at` is now set.
- [ ] Re-run immediately — confirm no re-notify. Manually set `last_reminder_sent_at = now() - interval '25 hours'`, re-run — confirm it fires again.
- [ ] If an email fails, check `email_queue.last_error` (retries automatically while `attempts < 3`) or `email_log` (once attempts are exhausted) — same as every other notification in this system.
