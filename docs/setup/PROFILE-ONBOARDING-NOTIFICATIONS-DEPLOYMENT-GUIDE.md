# Profile Onboarding Notifications — Deployment Guide

Exact, ordered steps to deploy what's described in [`docs/ONBOARDING-WORKFLOW-ARCHITECTURE.md`](../ONBOARDING-WORKFLOW-ARCHITECTURE.md) Section A: three notifications fired when a brand-new `profiles` row is created, plus a manual employee-linking action on the Users page. The frontend pieces (banner, the Users page's KPI cards, `UserEmployeeLink.jsx`) are already in this repo's code — only the SQL side needs deploying.

## 0. Prerequisite

- [ ] The core notification system from [`NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./NOTIFICATIONS-DEPLOYMENT-GUIDE.md) must already be deployed — this reuses `emit_notification_event`/`fan_out_notification_event`/`notification_rules.target_payload_keys` as-is.

## 1. The trigger function + trigger

- [ ] Run **`supabase/functions/notify_profile_created.sql`**.
- [ ] Run **`supabase/triggers/trg_notify_profile_created.sql`** (`create or replace trigger`, safe to re-run).

## 2. Seed the three notification rules

- [ ] Run **`supabase/sql_editor/seed_profile_created_needs_department_assignment_rule.sql`** — targets `superadmin`.
- [ ] Run **`supabase/sql_editor/seed_profile_created_needs_employee_link_rule.sql`** — targets `HR`.
- [ ] Run **`supabase/sql_editor/seed_profile_created_welcome_rule.sql`** — targets the new profile itself.

**Checkpoint: the three profile-created notifications are now live.** A brand-new login will notify superadmin (if still in the default `General` department), HR, and welcome the new person, all immediately.

## 3. The manual employee-linking RPC

- [ ] Run **`supabase/functions/link_profile_to_employee.sql`**.

No seed/rule needed for this one — it's a plain RPC the frontend calls directly (`src/features/superadmin/users/private/api/employeeLink.js`), not a notification event.

## Verifying it all worked

- [ ] Insert a test row directly (or use a real first-time login) with `department_id = 1`:
  ```sql
  insert into public.profiles (id, full_name, email, department_id)
  values (gen_random_uuid(), 'Test Onboarding User', 'test.onboarding@example.com', 1);
  ```
  Confirm three `notification_events` rows land (`profile.created.needs_department_assignment`, `profile.created.needs_employee_link`, `profile.created.welcome`), and matching `notifications`/`email_queue` rows for superadmin, HR, and that exact new profile.
- [ ] Insert a second test row with a non-`1` `department_id` — confirm only `needs_employee_link` and `welcome` fire this time, not `needs_department_assignment`.
- [ ] In the app, open **System → Users** — confirm 4 KPI cards (Total Users / Unassigned / Not Linked to Employee / Recently Created) now render at the top of the page, above the existing search/filter/list (single page, no separate tabs).
- [ ] Open a profile in the sidebar — confirm the new **Linked Employee** section appears, shows "Select an employee" if unlinked, and successfully links/unlinks via the picker (confirm `employees.profile_id` actually updates, and that the profile's `department_id` is untouched either way).
- [ ] Log in as (or otherwise view the app as) a `department_id = 1` profile — confirm the yellow "bare-minimum access" banner shows under the navbar on every page; dismiss it; confirm it stays dismissed for the rest of that session and reappears after a fresh login.
- [ ] If an email fails, check `email_queue.last_error` (retries automatically while `attempts < 3`) or `email_log` (once attempts are exhausted) — same as every other notification in this system.
