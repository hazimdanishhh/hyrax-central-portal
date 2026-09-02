# Employee Lifecycle Checklist — Deployment Guide

Deploys the schema/triggers/RLS/notifications behind [`docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md`](../EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md). The frontend (`src/features/employeeLifecycle/`, `src/data/{onboarding,offboarding}ChecklistMeta.js`, `src/pages/user/employeeLifecycle/`, the new routes/nav entries, and the Employee Management/IT Asset Management integration points) is already in this repo's code and requires no separate deployment beyond your normal `npm run build`/deploy — it's inert until the SQL below exists, so do the SQL first. Everything below runs in the Supabase Studio SQL editor — open each file, copy the whole thing, paste into the SQL editor, run, in the order given. Follow in order — later steps genuinely depend on earlier ones.

## 0. Prerequisite verification

Confirm the schema assumptions this module depends on before running any DDL against them:

```sql
select a.attname, format_type(a.atttypid, a.atttypmod)
from pg_attribute a join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('employees','it_assets')
  and a.attname in ('id','asset_user_id') and a.attnum > 0 and not a.attisdropped;

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'employment_status';
```

Confirm `employees.id`/`it_assets.asset_user_id` come back `uuid`, and `employment_status` has a real `category` column. **If either check doesn't come back as expected, stop here** — every FK/trigger condition below depends on it.

## 1. Schema

Run `supabase/sql_editor/employee_lifecycle_schema_migration.sql`, then `supabase/sql_editor/profiles_add_deactivated_at.sql`.

**Checkpoint: the two new tables exist, RLS-enabled with zero policies yet — no one can read/write them at all, including you testing in the app. That's expected and safe**, matching the Projects & Tasks module's own precedent — locked down until step 9.

## 2. Shared utility functions

Nothing new — `set_updated_at()` already exists live, reused as-is in step 7.

## 3. Helper function

Run `supabase/functions/is_department.sql`. Order doesn't matter relative to step 4 below, but must exist before step 9 (RLS).

## 4. Case lifecycle & sync integrity functions

Run, in any order:

- `supabase/functions/get_or_create_onboarding_case.sql`
- `supabase/functions/get_or_create_offboarding_case.sql`
- `supabase/functions/sync_lifecycle_item_on_profile_linked.sql`
- `supabase/functions/sync_lifecycle_item_on_role_department_assigned.sql`
- `supabase/functions/sync_lifecycle_item_on_it_asset_assignment.sql`
- `supabase/functions/sync_lifecycle_item_on_profile_deactivated.sql`

## 5. RPC

Run `supabase/functions/deactivate_profile.sql`.

## 6. Notification-emitting trigger + scan functions

Run, in any order:

- `supabase/functions/handle_employee_onboarding_case_open.sql`
- `supabase/functions/handle_employee_offboarding_case_open.sql`
- `supabase/functions/check_lifecycle_case_completion.sql`
- `supabase/functions/check_employee_offboarding_last_day_approaching.sql`
- `supabase/functions/check_employee_offboarding_overdue.sql`

## 7. Wire up every trigger

Run every file in `supabase/triggers/` named `trg_employee_onboarding_case_open.sql`, `trg_employee_offboarding_case_open.sql`, `trg_lifecycle_case_completion.sql`, `trg_sync_lifecycle_item_on_profile_linked.sql`, `trg_sync_lifecycle_item_on_role_department_assigned.sql`, `trg_sync_lifecycle_item_on_it_asset_assignment.sql`, `trg_sync_lifecycle_item_on_profile_deactivated.sql`, `trg_set_employee_lifecycle_cases_updated_at.sql`, `trg_set_employee_lifecycle_case_items_updated_at.sql`. All `create or replace trigger`, safe to re-run. These are new sibling triggers only — `trg_notify_profile_created`, `trg_notify_profile_updated`, `trg_notify_employee_profile_linked`, and every other Section A/B trigger stay exactly as they were; Postgres fires multiple triggers per event without conflict.

## 8. View

Run `supabase/sql_editor/employee_lifecycle_cases_views.sql`.

**Verify**: as a non-HR/non-IT test user, `select * from employee_lifecycle_cases_with_progress;` returns zero rows (still locked — RLS on the base tables has zero policies until step 9).

## 9. RLS policies

Run `supabase/policies/employee_lifecycle_cases_crud.sql`, then `supabase/policies/employee_lifecycle_case_items_crud.sql`.

**Checkpoint: nothing works in the app until this step. After this step, the module is live** for HR/IT/superadmin viewing and acting on cases — employee self-service still shows nothing until step 11's backfill (or a real new hire) creates a case with `employee_can_view` set.

## 10. Seed notification rules

Run `supabase/sql_editor/seed_employee_lifecycle_notification_rules.sql`.

### 10a. Pause the two Shape-B rules

**Run this before step 11** — real employees may already be mid-notice-period, and the very first cron tick after the backfill would otherwise flood HR/IT on day one:

Run `supabase/sql_editor/pause_employee_offboarding_scan_rules.sql`.

## 11. One-time backfill

Run `supabase/sql_editor/backfill_employee_lifecycle_cases.sql`. This creates cases for employees already in the table at deploy time — anyone already mid-Probation gets an onboarding case; anyone with a `resignation_date` set or already in "Terminated Notice" gets an offboarding case. Deliberately does **not** backfill anyone already fully terminated (no way to tell "just happened" from "years ago" — see the file's own header comment).

**Verify**: the query at the bottom of that file shows backfilled counts matching a manual `count(*)` against the same two guard conditions, run just before this step.

## 12. Cron

Run `supabase/sql_editor/schedule_check_employee_confirmations_cron.sql` (updated in this pass — adds two more calls to the existing `check-employee-lifecycle-daily` job body; **read the file's own "UPGRADING FROM AN EARLIER VERSION" note first** — if this job already exists, `cron.unschedule('check-employee-lifecycle-daily')` before re-running the `cron.schedule()` block, since re-scheduling the same job name does not update it).

Once HR/IT have manually reviewed the cases the step 11 backfill created, re-enable the two paused rules:

```sql
update public.notification_rules set is_active = true
where event_type in ('employee.offboarding_last_day_approaching', 'employee.offboarding_overdue');
```

**That flip — not step 12 itself — is the actual go-live moment for those two notifications.**

## 13. Post-launch addition — hardening pass (2026-09-02)

If you've already run steps 0–12 above, this is the only new SQL to run — see `docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md`'s "Hardening pass" section for why.

- Run `supabase/functions/get_or_create_offboarding_case.sql` again (coalesce order fix — `create or replace function`, safe to re-run).
- Run `supabase/sql_editor/employees_add_contract_offboarding_case_opened_at.sql`, then `supabase/functions/check_employee_contract_offboarding_due.sql`.
- Re-run `supabase/sql_editor/schedule_check_employee_confirmations_cron.sql` — its body now has 6 calls instead of 5. **Unschedule first**: `select cron.unschedule('check-employee-lifecycle-daily');` (schedule() with the same name doesn't update an existing job), then re-run the file.
- Run `supabase/functions/check_employee_confirmations_due_soon.sql` and `check_employee_confirmations_overdue.sql` again (both gained a `not exists (open OFFBOARDING case)` condition — `create or replace function`, safe to re-run).
- Re-run `supabase/sql_editor/get_hr_employees_dashboard_rpc.sql` in full (the `contractActionsDueCount` KPI's matching logic changed — this is the existing HR dashboard RPC, not new to this module, but touched here).
- Run `supabase/sql_editor/seed_access_card_asset_subcategory.sql` — confirm it actually inserted a row (`select * from it_asset_subcategory where name = 'Access Card';`), since it silently no-ops if "Security" isn't found under that exact name.

**Checkpoint: contract/non-full-time employees now get a real offboarding case with lead time, HR/superadmin can drive offboarding through guided buttons instead of raw field edits, and the confirmation-reminder/offboarding notification collision is gone.**

## 14. UAT-readiness pass (2026-09-02)

If you've already run steps 0–13 above, this is the only new SQL to run — see `docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md`'s "UAT readiness pass" section for why. Run in this order:

1. **Before re-enabling the paused rules**, preview roughly how many notifications the first tick will produce (see the comment at the top of the file below for the exact query), then run `supabase/sql_editor/resume_employee_offboarding_scan_rules.sql` — re-enables `employee.offboarding_last_day_approaching`/`employee.offboarding_overdue`, superseding the manual `UPDATE` shown in step 12 above (run this file instead of retyping that snippet).
2. Run `supabase/sql_editor/update_offboarding_case_completed_notify_it.sql` — adds IT as a co-recipient of `employee.offboarding_case_completed`.
3. Run `supabase/sql_editor/employee_lifecycle_cases_add_hr_items_reminder_column.sql`, then `supabase/functions/check_employee_offboarding_hr_items_approaching.sql`, then `supabase/sql_editor/seed_offboarding_hr_items_approaching_notification_rule.sql` — the new HR-side proactive reminder, seeded active immediately (no pause needed).
4. Re-run `supabase/sql_editor/schedule_check_employee_confirmations_cron.sql` — its body now has 7 calls instead of 6. **Unschedule first**: `select cron.unschedule('check-employee-lifecycle-daily');`, then re-run the file.
5. Run `supabase/functions/handle_employee_onboarding_case_open.sql` again (`create or replace function`, safe to re-run — it previously emitted no notifications at all; now emits two), then `supabase/sql_editor/seed_onboarding_case_opened_notification_rules.sql`. No cron change needed — this is Shape A (change-triggered), already wired via the existing `trg_employee_onboarding_case_open.sql`.
6. Frontend: the "Immediate Termination" button is now "Immediate Departure (No Notice)" and asks for Final Status instead of assuming Terminated — ships with your normal build/deploy, nothing to run in SQL for this part. **Before real UAT use**, check the live `termination_reason` table's content — if every row reads as termination-specific with nothing resignation/retirement-appropriate, add a few neutral rows first (no seed file provided here since the gap is unconfirmed; follow `seed_access_card_asset_subcategory.sql`'s pattern if needed).

**Checkpoint: all nine lifecycle notification rules are live (none paused), a new hire's onboarding case-open now actually notifies HR/manager/IT instead of no one, IT gets offboarding-completion confirmations, HR gets the same proactive last-day reminder IT already had, and the guided no-notice-departure button no longer assumes the outcome is always a termination.**

## Frontend

Already shipped in this repo, ships via your normal build/deploy — nothing to do here beyond confirming, once you're logged in as HR/IT/superadmin, that new sidenav entries "Onboarding"/"Offboarding" appear under both the HR and IT segments.

## Verifying it all worked

- [ ] Insert a test employee row with `employment_status_id = 3` (Probation) — confirm an `ONBOARDING` case appears in `employee_lifecycle_cases` with all 12 items seeded (`select item_key, status from employee_lifecycle_case_items where case_id = '<id>';`).
- [ ] Link that employee's `profile_id` — confirm the `profile_linked` item flips to `DONE` automatically, with no notification duplicated (Section A's `employee.profile_linked` still fires exactly as before, unchanged).
- [ ] Assign an `it_assets` row to that employee (with `needs_it_asset = true` set first) — confirm `it_asset_assigned` flips to `DONE`.
- [ ] Mark every remaining item `DONE`/`SKIPPED` by hand — confirm the case auto-flips to `COMPLETED` and `employee.onboarding_checklist_completed` fires (`select * from notification_events where event_type = 'employee.onboarding_checklist_completed' order by occurred_at desc limit 1;`).
- [ ] On the same (or a different) test employee, set `resignation_date` to a future date — confirm an `OFFBOARDING` case opens with all 13 items, `employee.offboarding_case_opened` and `employee.offboarding_it_revocation_needed` both fire, and — if that employee still had an `OPEN` onboarding case — confirm it auto-`CANCELLED` with `closed_reason = 'offboarding_case_opened'`.
- [ ] Clear that `resignation_date` back to `null` while status is still active-category — confirm the offboarding case auto-`CANCELLED` with `closed_reason = 'resignation_retracted'`, and confirm no notification fires for this reversal (negative case).
- [ ] As an HR test user, attempt to update an IT-owned item (`workspace_account_created`) — confirm it's rejected; the same call against an HR-owned item succeeds.
- [ ] As the case's own employee (test account with `employee_can_view = false`), confirm `/app/employee/offboarding` shows nothing; flip `employee_can_view = true` — confirm only `employee_visible = true` items/fields now appear, and `resignation_acknowledged`/`software_access_revoked`/`credentials_rotated`/`workspace_account_revoked`/`handover_plan_documented`/`portal_account_deactivated` never do.
- [ ] In the app: open **HR → Onboarding** and **IT → Onboarding** for the same case — confirm identical checklist state, but Mark Done only works for the viewer's own department's items (and for superadmin, on everything including the `role_department_assigned` item neither HR nor IT can act on).
- [ ] Confirm the Employee Management page's **default card view** (not just the table-layout toggle) shows a lifecycle-case badge next to an in-progress employee's status badge — this is the view most likely to be forgotten.
- [ ] Confirm the Employee Management sidebar (click an employee row) shows the `EmployeeLifecycleCaseSummary` block, and that an employee with both an open onboarding and open offboarding case shows two blocks, not one overwriting the other.
- [ ] Click the new "Open Lifecycle Cases" tile (HR Employee Overview) and "Employees Awaiting IT Setup" tile (IT Asset Overview) — confirm each sub-metric link lands on a page showing that same count.
- [ ] If an email fails, check `email_queue.last_error` (retries automatically while `attempts < 3`) or `email_log` (once attempts are exhausted) — same as every other notification in this system.

**Hardening pass (step 13) additions:**

- [ ] As HR, click "Begin Offboarding (Notice)" on an active test employee — fill in the modal, confirm `employment_status_id` becomes 13, an `OFFBOARDING` case opens, and its `expected_last_day` matches what you entered in the modal (not `employees.end_date`, which should stay untouched).
- [ ] As HR, confirm `employment_status_id`/`end_date`/`resignation_date`/`termination_reason_id` render but are **not editable** in the plain employee edit form; as superadmin, confirm the same four fields **are** editable.
- [ ] Set a test employee's `employment_type_id` to a non-"Full-time" type and `end_date` within 30 days, with `employment_status_id` still active-category — confirm `check_employee_contract_offboarding_due()` opens an `OFFBOARDING` case with `expected_last_day` matching `end_date`, without you touching `employment_status_id` at all.
- [ ] Insert a test employee on Probation with a `confirmation_due_date` inside the next 30 days, then open an `OFFBOARDING` case for them — confirm `check_employee_confirmations_due_soon()` no longer fires for them (negative case).
- [ ] Click "Deactivate Portal Account" from an offboarding case's detail page — confirm `profiles.deactivated_at` is set and `portal_account_deactivated` flips to `DONE` automatically. Repeat from the Users page's employee-link sidebar.

**UAT-readiness pass (step 14) additions:**

- [ ] `select event_type, is_active from notification_rules where event_type like 'employee.offboarding%' or event_type like 'employee.onboarding%';` — confirm all nine lifecycle rules show `is_active = true`, none paused.
- [ ] Insert a new test employee row with `employment_status_id = 3` (Probation) — confirm both an HR test user and an IT test user receive a notification (`employee.onboarding_case_opened` and `employee.onboarding_it_setup_needed` respectively), where previously nobody was notified at all. If that employee has a `manager_id` set, confirm the manager also receives the HR-audience notification.
- [ ] Mark every item DONE/SKIPPED on a test `OFFBOARDING` case where the last recipient department is IT — confirm an IT test user receives the `employee.offboarding_case_completed` notification, not just HR/superadmin.
- [ ] On a test `OFFBOARDING` case with an `OPEN` HR-owned item and `expected_last_day` within 7 days, run `select public.check_employee_offboarding_hr_items_approaching();` manually — confirm a notification lands for an HR test user, and re-running it immediately after does **not** re-notify (3-day cooldown via `hr_items_reminder_last_notified_at`).
- [ ] As HR, click "Immediate Departure (No Notice)" on an active test employee — confirm the modal asks for **Final Status** (Terminated/Resigned/Retired) rather than assuming Terminated, and that picking "Resigned" actually sets `employees.employment_status_id = 5`.
- [ ] Confirm the modal's reason field now reads "Reason for Departure" (not "Termination Reason") on both "Begin Offboarding (Notice)" and "Immediate Departure (No Notice)."
- [ ] Confirm `docs/NOTIFICATION-RULES-TRACKER.csv` shows all seven lifecycle rows as `Implemented`.
