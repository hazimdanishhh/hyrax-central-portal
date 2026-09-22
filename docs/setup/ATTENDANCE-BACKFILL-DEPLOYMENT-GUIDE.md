# Attendance Backfill / Reconciliation — Deployment Guide

Everything in `supabase/` is hand-run in the Supabase SQL editor; editing a
`.sql` file in this repo does **not** change production.

**Steps 1–16 are SQL, in order. Step 17 is the frontend.** Each file is run
exactly once — where a step re-runs an existing function it is a
`create or replace`, so paste the whole file as it stands in the repo.

**The ordering is not cosmetic.** Three places will cause real, user-visible
damage if run out of order — see the warnings on steps 3–4, 7 and 12.

---

## 1. `attendance_adjustment_reasons_migration.sql`

The "why was this entered by hand" vocabulary: lookup table, both RLS policies,
six seeded rows.

**Must be first**: step 2 adds a foreign key to this table, and its SELECT
policy must exist before anything joins it. Both attendance views run
`security_invoker = on`, so a table with RLS enabled and no SELECT policy
returns **silently empty** through them rather than erroring — the same failure
`attendance_logs` had for months (see
`docs/hr/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md`).

```sql
select code, label, requires_notes from public.attendance_adjustment_reasons order by sort_order;
-- 6 rows; 'other' is the only requires_notes = true
select policyname, cmd from pg_policies where tablename = 'attendance_adjustment_reasons';
-- 3: one SELECT, two ALL (HR, superadmin)
```

## 2. `attendance_activities_add_entry_method_columns.sql`

Adds `entry_method`, `adjustment_reason_id`, `created_by`, and the
`(employee_id, clocked_in_at)` index. Needs step 1 for the FK.

```sql
select count(*) from public.attendance_activities where entry_method <> 'self_clock_in';
-- 0 -- every pre-existing row genuinely was a live self clock-in
```

## 3. `attendance_types_add_is_self_selectable_column.sql`

Adds **two** columns despite the filename: `is_self_selectable` (keeps the
scanner-only locations out of the live clock-in dropdown) and `is_full_day`
(recorded as whole days, no clock in/out — the business trips).

## 4. `seed_attendance_types_backfill_rows.sql`

Adds Overseas Trip, Local Trip, Company Event, Driving Duty, and re-adds
Office + Blending Plant as backfill-only. Needs step 3.

```sql
select name, is_self_selectable, is_full_day
from public.attendance_types order by name;
-- Office, Blending Plant    -> is_self_selectable false
-- Overseas Trip, Local Trip -> is_full_day true
-- everything else           -> is_self_selectable true, is_full_day false
```

> **Steps 3–4 must land before the frontend (step 17).** Old JS against the new
> columns is harmless. New JS against the old schema reads `is_full_day` as
> `undefined` for every type, which turns the trip types back into timed days
> and starts asking for clock times that don't apply.

## 5. `attendance_reconciliation_acknowledgements_migration.sql`

Two tables — `attendance_acknowledgement_reasons` and the acknowledgements
themselves — plus RLS and the reason seed. Needed by steps 6 and 13–15.

```sql
select code, label, applicable_categories, requires_notes
from public.attendance_acknowledgement_reasons order by sort_order;
-- 6 rows; 'other' is the only requires_notes = true and the only one
-- applicable to BOTH categories
```

## 6. `acknowledge_attendance_day_rpc.sql`

`acknowledge_attendance_day` + `revoke_attendance_day_acknowledgement`. Needs
step 5.

## 7. `supabase/functions/notify_attendance_clocked_in.sql`, then `supabase/triggers/trg_notify_attendance_clocked_in.sql`

> **Must run BEFORE step 10.** That trigger currently fires on _every_ insert
> into `attendance_activities`. Deploy the backfill RPC first and the first bulk
> run sends every affected employee one "You are now clocked in — remember to
> clock out" notification **per day created** — 5 employees × 10 days = 50 wrong
> messages about closed sessions in the past, and they cannot be recalled.

```sql
select tgname, pg_get_triggerdef(oid) from pg_trigger
where tgname = 'trg_notify_attendance_clocked_in';
-- the definition must now contain a WHEN (...) clause
```

## 8. `seed_attendance_backfill_notification_rule.sql`

Seeds the `attendance.backfilled` rule (`in_app` only for now — the file's own
header explains why email stays off while the app is in testing). Before the
first emit in step 10, or that backfill notifies nobody and cannot be replayed.

## 9. `get_attendance_backfill_prefill_rpc.sql`

## 10. `create_attendance_backfill_rpc.sql`

The main write path, including `day_shape` (a whole-day type derives its clock
times server-side from the shape plus the employee's work location, and ignores
any times sent anyway). Needs steps 1, 2, 3 and 8.

## 11. `hr_unified_daily_attendance_view.sql`

One added line in `active_company_dates`, capping the **activity-derived**
branch at today. Without it a single future-dated row pulls that date into the
spine, which cross-joins every active employee and flags them all `Absent` on a
day that hasn't happened — corrupting `absent_days_count`, `attendanceRatePct`,
`absenteeismRatePct` and the Top Absenteeism leaderboard in both dashboard RPCs.

Purely restrictive, inside a CTE — no column added, removed or reordered, so it
carries none of this view's usual append-only risk.

```sql
-- unchanged vs. before for any past period
select count(*) from public.unified_daily_attendance
where work_date between '2026-08-01' and '2026-08-31';
```

## 12. `hr_attendance_activity_audit_view.sql`

Appends `entry_method`, `adjustment_reason_id`, `adjustment_reason_label`.
Needs step 2's columns to exist.

> **`CREATE OR REPLACE VIEW` can only APPEND columns, never reorder or rename
> them** (error 42P16 — `cannot change name of view column ...`). This view's
> final `SELECT` uses an explicit column list rather than `ae.*` precisely
> because that trap has already been hit here once. The three new columns go
> **after** `ae.notes`, with matching `NULL` placeholders aligned in all three of
> `hw_events` / `leave_events` / `holiday_events` so the `UNION ALL` lists still
> line up positionally.
>
> Decide the full appended list **before** running it. A later
> `CREATE OR REPLACE` can only append again, permanently behind these.

```sql
select ordinal_position, column_name from information_schema.columns
where table_name = 'attendance_activity_audit' order by ordinal_position;
-- positions 1-21 unchanged; 22 entry_method, 23 adjustment_reason_id,
-- 24 adjustment_reason_label
```

## 13–16. The four consumers that must now respect an acknowledgement

All need step 5. In any order among themselves, but **all four are required** or
a resolved flag clears in some places and not others.

| #   | File                                                           | Why it needs its own change                                                                                                               |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | `supabase/functions/get_payroll_reconciliation_rows.sql`       | Clears **three** surfaces at once — the HR drilldown sidebar, the emailed list, and the weekly employee reminder all call this one helper |
| 14  | `supabase/functions/send_payroll_reconciliation_hr_digest.sql` | Computes its own `has_absent` / `has_insufficient_half_day` directly from the view, so it needs a separate copy of the filter             |
| 15  | `get_payroll_period_summary_rpc.sql`                           | Adds `unacknowledgedAbsenceCount` / `unacknowledgedInsufficientHalfDayCount`                                                              |
| 16  | `queue_payroll_reconciliation_email_rpc.sql`                   | Per-date deep links in the emailed date list                                                                                              |

> **`daysAbsentCount` deliberately still counts acknowledged days.** The
> employee was absent and payroll still deducts an unpaid day — acknowledging
> closes the _review_, not the _fact_. The `unacknowledged*` counts are what
> drive the row-flag badge and the "Needs Reconciliation" filter. If anyone ever
> "fixes" this by making `daysAbsentCount` skip acknowledged days, payroll will
> silently under-report unpaid days.

```sql
-- after acknowledging one absence: daysAbsentCount unchanged,
-- unacknowledgedAbsenceCount one lower
select get_payroll_period_summary('2026-09-01', '2026-09-30', null, null, null);
```

## 17. Frontend

No action beyond a normal deploy — but **after steps 3–4** (see the warning
there).

---

## Smoke test

**Live clock-in is unchanged.** Dashboard fingerprint button → the type dropdown
shows Overseas Trip / Local Trip / Company Event / Driving Duty and **not**
Office or Blending Plant. Clock in and confirm the "You are now clocked in"
notification still arrives.

**HR bulk backfill.** HR Attendance List → _Backfill Attendance_ → 2 employees,
a 5-day range.

1. Pick **Overseas Trip** on the details step → the date step offers Full/AM/PM
   and **no** time inputs. Go back, pick **Site Visit** → time inputs appear,
   seeded 08:30–17:00 for a KL employee and 08:30–17:30 for Meru. Neither
   default should produce any overtime: since 2026-09-22 the threshold is a
   flat 8 paid hours (a 9-hour span including the unpaid lunch), so Meru's
   default lands exactly on it and KL's sits half an hour under. Confirm
   `overtime_hours` reads 0 on every backfilled full day — a nonzero value
   there means the seeded times or the threshold have drifted apart.
2. Change a date's shape from Full to Half AM → its times re-seed to
   08:30–12:30. Edit a time by hand, then change the shape → confirm the row is
   not silently left on the hand-edited value.
3. Weekends and public holidays start unticked; a date one employee already has
   attendance on comes back `skip` / `overlaps_existing_activity`, not `add`.
4. Commit, then in the table editor confirm on the new rows:
   `entry_method = 'hr_backfill'`, `approval_status = 'Approved'`, `created_by`
   and `approved_by` both set, and **`clocked_out_at` not null on every row**.
5. Each affected employee got **one** notification, not one per day, and **no**
   "You are now clocked in" messages.

**Declaring vs fixing.** My Attendance and Team Attendance show **"Add
Attendance"** (not "Fix"), with the trip types sorted first. Declare a 3-day
Overseas Trip: whole days, no time prompts. Confirm the only way to fix a broken
past day from those two pages is opening that day's sidebar.

**The day sidebar.** Open any day (HR, My, Team) → _Add Activity_ (labelled
_Report Missing Activity_ for an employee) → employee and date are fixed and
correct → save → the new card appears in the timeline immediately with its
provenance badge. As an employee, the row must land `Pending` and the manager
must be able to approve it through the existing Team Attendance flow unchanged.

**Add Single Activity actually submits.** HR Attendance List → _Add Single
Activity_ → pick an employee, a work date, both times → save. This was
unsubmittable before this pass (the time fields could never be filled), so it is
worth an explicit check.

**Acknowledgement.**

1. Payroll Export → a flagged employee → click a Days Absent card → it opens
   **that day's sidebar**, not a filtered list → _Acknowledge Absence_ with a
   reason.
2. The day leaves the reconciliation list and the row's flag badge count drops,
   but its **Days Absent figure is unchanged**.
3. As that employee, acknowledge one of your own absences from My Attendance's
   day sidebar. Confirm you **cannot** acknowledge an insufficient-half-day
   (HR only).
4. Revoke it as HR → the flag comes back.

**Future date.** Back-fill a date next week, then confirm HR's Attendance List
for that date shows **no** company-wide `Absent` rows (the step 11 spine cap).

---

## Rollback

Everything here is additive (`add column if not exists`, `create or replace`), so
the app can be rolled back on its own without touching SQL. To back the SQL out
as well:

```sql
-- New functions
drop function if exists public.create_attendance_backfill(jsonb, boolean, boolean);
drop function if exists public.get_attendance_backfill_prefill(uuid[], date[]);
drop function if exists public.acknowledge_attendance_day(uuid, date, text, bigint, text);
drop function if exists public.revoke_attendance_day_acknowledgement(uuid, date, text);

-- New tables (drops every acknowledgement ever recorded -- export first if the
-- period has already been reported on)
drop table if exists public.attendance_reconciliation_acknowledgements;
drop table if exists public.attendance_acknowledgement_reasons;

-- Stops the backfill notification firing without deleting its history
delete from public.notification_rules where event_type = 'attendance.backfilled';
```

Then re-run the **previous** versions of these from git history:

- `supabase/triggers/trg_notify_attendance_clocked_in.sql` and
  `supabase/functions/notify_attendance_clocked_in.sql`
- `supabase/functions/get_payroll_reconciliation_rows.sql`
- `supabase/functions/send_payroll_reconciliation_hr_digest.sql`
- `supabase/sql_editor/get_payroll_period_summary_rpc.sql`
- `supabase/sql_editor/queue_payroll_reconciliation_email_rpc.sql`
- `supabase/sql_editor/hr_unified_daily_attendance_view.sql`
- `supabase/sql_editor/hr_attendance_activity_audit_view.sql`

**Do not drop `entry_method`** once any backfilled rows exist — it is the only
thing distinguishing an asserted record from an observed one, and
`notify_attendance_clocked_in`'s guard reads it. Dropping it would make every
backfilled row look like a live clock-in.

**`attendance_activity_audit` cannot shed columns via `CREATE OR REPLACE`** — a
true revert of step 12 needs `drop view` first, which also requires dropping and
recreating anything depending on it.
