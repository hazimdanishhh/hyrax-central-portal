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
