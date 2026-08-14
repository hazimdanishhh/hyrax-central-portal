# Employee Confirmation Due-Soon Reminder — Deployment Guide

Exact, ordered steps to deploy the scheduled-scan ("Shape B") notification described in [`docs/NOTIFICATIONS-ARCHITECTURE.md`](../NOTIFICATIONS-ARCHITECTURE.md#worked-example-2-employee-confirmation-due-soon-scheduled-scan). This is the first notification whose source is a periodic scan rather than a row-change trigger, and it also introduces `notification_rules.target_payload_keys` — a generic way to notify whoever a specific event points at (here, an employee's own manager), not just a static role/department.

Everything under **SQL Editor** runs in the Supabase Studio SQL editor.

## 0. Prerequisite

- [ ] The core notification system from [`NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./NOTIFICATIONS-DEPLOYMENT-GUIDE.md) (steps 0–5 at minimum) must already be deployed — this reuses `emit_notification_event`, `fan_out_notification_event`, `notification_rules`, `notifications`, and `email_queue` as-is. If in-app notifications from a lead stage change don't already work, do that guide first.

## 1. Schema additions

- [ ] Run **`supabase/sql_editor/employees_add_confirmation_reminder_sent_at.sql`**. Adds `employees.confirmation_reminder_sent_at` — the dedup guard so the daily scan doesn't re-notify the same employee every day of the 30-day window.
- [ ] Run **`supabase/sql_editor/notification_rules_add_target_payload_keys.sql`**. Adds `notification_rules.target_payload_keys text[]`, default `'{}'` — existing rules (the lead-stage one) are unaffected.

## 2. Update `fan_out_notification_event`

- [ ] Re-run the full, updated **`supabase/functions/fan_out_notification_event.sql`** (`create or replace function`, safe to re-run). This is the same function from the original deployment, now with one added recipient path: any `target_payload_keys` entry whose payload value is a valid uuid is also treated as a recipient, alongside role/department/explicit-list. Must be done before step 5's rule is exercised, since that rule is the first to use `target_payload_keys`.

## 3. The new scan function

- [ ] Run **`supabase/functions/check_employee_confirmations_due_soon.sql`** as-is.

This is a complete `create or replace function` — no wrapping needed (unlike `log_sales_leads_stage_change.sql`, this isn't a trigger function, so there's no separate "just the body" convention here).

## 4. Seed the notification rule

- [ ] Open **`supabase/sql_editor/seed_employee_confirmation_notification_rule.sql`** first. Recipients are the employee's own manager (`target_payload_keys = ['manager_profile_id']`) **and** HR broadly (`target_roles = ['manager'], target_departments = ['HR']`) — edit now if you want different recipients, otherwise run as-is and `update` the row later, no code changes needed either way.
- [ ] Run the file.

## 5. Schedule the scan

- [ ] Run **`supabase/sql_editor/schedule_check_employee_confirmations_cron.sql`** as-is. Unlike the email dispatcher's cron, this one calls the Postgres function directly — no `pg_net`, no secret, no Edge Function, since the whole job never leaves Postgres.

**Checkpoint: the reminder is now fully live.** It'll run once a day and pick up any employee whose confirmation becomes due within 30 days, skipping anyone it already notified.

## Verifying it all worked

Waiting for a real employee to enter the 30-day window isn't practical for testing, so verify manually instead:

- [ ] Pick a test employee (or a real one you're comfortable temporarily editing) and set: `employment_status_id` to Probation, `confirmation_date` to `null`, and `join_date` to `current_date - interval '5 months' - interval '20 days'` (lands `confirmation_due_date` about 10 days out — inside the window). Make sure `confirmation_reminder_sent_at` is `null`.
- [ ] Run `select public.check_employee_confirmations_due_soon();` directly in the SQL editor.
- [ ] Confirm a row landed in `notification_events` with `event_type = 'employee.confirmation_due_soon'`.
- [ ] Confirm `notifications` has a row for the employee's manager's `profile_id` (if that manager has one) **and** for each profile with `role = 'manager'` and `department.sub = 'HR'`.
- [ ] Confirm matching rows in `email_queue` (and, once the email dispatcher cron ticks, `email_log` with `status = 'sent'`).
- [ ] Confirm `employees.confirmation_reminder_sent_at` is now set for that employee — re-running `check_employee_confirmations_due_soon()` should no longer pick that row up.
- [ ] Change a lead's stage again (Proposal→Negotiation or →Won) and confirm it still works exactly as before — `target_payload_keys` defaults to `'{}'` for that rule, so step 2's change shouldn't have affected it at all.

## Manual Run Test

Run:

```sql
select public.check_employee_confirmations_due_soon();
```

Check it worked:

```sql
select * from public.notification_events order by occurred_at desc limit 3;
select * from public.notifications order by created_at desc limit 10;
select * from public.email_queue order by created_at desc limit 10;
```
