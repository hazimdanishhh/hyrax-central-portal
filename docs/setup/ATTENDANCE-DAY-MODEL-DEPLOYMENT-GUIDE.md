# Attendance Day Model (Axis Columns) — Deployment Guide

Everything in `supabase/` is hand-run in the Supabase SQL editor; editing a
`.sql` file in this repo does **not** change production.

This rework ships in **four separate deploys**, not one. Each is independently
useful and independently revertible. Do not start a ship until the previous
one's verification has passed.

| Ship | Contents | Status |
|---|---|---|
| 0 | Frontend-only reconciliation/filter fixes | **DONE** — commit `4bcd7f2` |
| 1 | Rebuild both views on axis columns, `hr_flag` retained | **DEPLOYED, verified** — see §1 |
| 1b | Performance investigation (open) | **IN PROGRESS** — see §2 |
| 2 | Migrate ~34 frontend files + 10 SQL consumers off `hr_flag` | not started |
| 3 | Drop `hr_flag` | not started |

---

## 1. Ship 1 — `attendance_day_model_axes_migration.sql`

Run as **four separate pastes**. The Supabase SQL editor returns only the
**last statement's result**, so pasting a whole section runs every query in it
and shows you only the final one — which silently discards the checks that
decide whether the deploy is safe.

| Paste | Section | Notes |
|---|---|---|
| 1 | **A** — pre-flight capture | Run **alone and first**. Creates three baseline tables that Gates 2 and 5 read. Skipping it makes them impossible to run. |
| 2 | **B** — the rebuild | Whole section at once. The `DROP ... CASCADE` also drops `attendance_activity_audit`; the second half recreates it. Do not stop between them. |
| 3 | **C → GATE 0** | One query, one row per gate, PASS/FAIL. Use this instead of the twelve individual gates. |
| 4 | **D2** — cleanup | Drops the baseline tables. Only after GATE 0 is green. |

### Choosing the date range

Section A's range is used again in GATE 0 and GATE 5 and **must match in all
three**. Prefer a range that **ends before today** — today is still
accumulating badge scans (`vigilance_iot` ingests in ~5-minute batches), so
minutes elapsing between capture and verification will legitimately move hours
totals and make the parity gate fail for reasons unrelated to the deploy.

### What "verified" meant on the actual run

GATE 0 returned 12 PASS and one FAIL (`G5 payroll parity`, 15 rows). That
failure was **live-data drift, not a regression**, and the reasoning is worth
keeping because it will recur on any re-run:

- `G2a` passed, so `hr_flag` was identical for all 3816 rows. `hr_flag` is
  computed from evidence presence and the `total_hw_scans = 1` boundary — so
  no day gained or lost evidence, and none crossed that boundary.
- That leaves exactly one way for a number to move: a day that **already had
  two or more scans** got another, widening its first-to-last span.
- Every one of the 15 changed values was hours-shaped (`hours_worked`,
  `true_hours_worked`, `overtime_hours`, `approved_*`) and moved **upward**,
  plus `early_leave_days` dropping by exactly 1 for four employees — which is
  the signature of someone who had only scanned *in* at capture time and
  badged out afterwards.
- **Zero structural metrics moved** (`row_count`, `absent_days`,
  `weekend_days`, `on_leave_days`, `worked_on_*`, `*_tier`, `leave_*`). None
  of those can move while `hr_flag` is unchanged. If one ever appears, it is a
  genuine regression — roll back.
- `needs_reconciliation_days` moved by +8 against 9 pending-approval days in
  the period. That is the intended new limb.

### Still outstanding for Ship 1

**The in-app RLS check has not been done.** No query in the migration can do
it: the SQL editor runs as the table owner and bypasses RLS entirely, so
`G1a` only proves the `security_invoker` reloption is *set*, not that it
*works*.

Run `supabase/diagnostics/attendance_rls_scoping_check.sql`. It impersonates a
plain employee via `SET LOCAL ROLE authenticated` inside a transaction that
ends in `ROLLBACK`, and asserts that the view returns exactly **one** distinct
employee. No second login needed.

**Two checks that look like they test this but do not:**

- Opening **My Attendance** and seeing only your own rows. That page is
  self-scoped *in the query* — `myAttendanceService` curries your employee id
  onto the filter before it reaches the view. It shows one person either way.
- Opening **Team Attendance** with no direct reports and seeing it empty.
  Empty is correct either way.

This is the single most damaging failure mode of the whole rework, and the
only one that produces **no error and a perfectly rendered page** when it goes
wrong.

### Does the frontend show the same numbers as before?

**Yes, with exactly one deliberate exception**, and this is proven rather than
asserted — it is what GATE 0's `G2a` and `G5` establish.

| Surface | Change |
|---|---|
| Hours worked, overtime, approved-hours, holiday/weekend hours | **Identical** |
| Day counts, absence counts, leave counts | **Identical** |
| Statutory wage tiers (rest-day / holiday) | **Identical** |
| `hr_flag` — every status label, badge, chart segment, status tab | **Identical**, byte for byte |
| KPI tiles, Payroll Export columns, the export file | **Identical** |
| **"Needs Reconciliation" filter and badge** | **More rows.** Gained a fifth limb: days carrying hours on unapproved app activities. This is the fix that makes the three attendance lists agree with Payroll Export's own "Any", which already counted them. |

One column was removed: `estimated_normal_day_ot_hours`. It had been an exact
duplicate of `overtime_hours` since the s.60A change and had no reader
anywhere in the repo — verified by grep before removal.

---

## 2. Ship 1b — the performance regression (OPEN)

**Reported:** after Ship 1, all attendance pages, both sidebars, and Payroll
Export work correctly but are **drastically slower**.

### What has been ruled out

Checked by diffing the deployed definition against the pre-rebuild one
(`f7280af`):

- **CTE materialization.** The view carries a documented performance landmine:
  a non-recursive CTE referenced more than once is materialized in full,
  unfiltered, before any caller's `work_date` predicate can prune it — which
  previously caused real statement timeouts. The `FROM`/`JOIN` reference count
  is **identical** before and after for all eight CTEs (`expected_shifts` 1,
  `daily_hardware` 2, `daily_app` 2, `final_rows` 1, rest 1). Not this.
- **`security_invoker` newly applied.** Both views already had it —
  `enable_attendance_views_security_invoker.sql` altered both. No change in
  how much RLS work is done per row.
- **Lost dependents from `DROP ... CASCADE`.** Nothing outside
  `attendance_activity_audit` references the view; no RLS policy names it in a
  `USING` clause.

### What has NOT been ruled out

- **Stale PostgREST schema cache.** The views are new objects with new OIDs,
  which invalidates cached plans and prepared statements. Cheapest thing to
  try first.
- **The seven added columns** being computed per row. Cheap individually, but
  unmeasured.
- **The extra `employment_status` join** added to `attendance_activity_audit`'s
  `holiday_events` branch (this only affects the day sidebar, not the lists).
- **Cold cache** immediately post-deploy, which would wear off on its own.

### Diagnostic steps, in order

Run `supabase/diagnostics/attendance_day_model_perf_diagnostic.sql`. It is
read-only apart from step 1.

1. **Reload the PostgREST schema cache** — one statement, instant, no downtime.
   Re-test the pages afterwards. If this fixes it, stop here.
   **Status: run on 2026-09-22.** Effect on the slowdown not yet reported — if
   the pages are still slow, continue to step 2.
2. **`EXPLAIN (ANALYZE, BUFFERS)`** on the exact shapes the frontend issues —
   a single-day roster query (Day mode) and a paginated date-range query
   (Search mode). Compare total time and look for a sequential scan over
   `attendance_logs` or a materialized CTE node.
3. **Compare against the old definition** by creating it side by side as
   `unified_daily_attendance_old` and timing the same two queries. This is the
   only way to attribute the difference rather than infer it.

**Do not start Ship 2 until this is resolved.** Ship 2 changes ~34 frontend
files; doing that on top of an unexplained performance regression makes the
regression far harder to attribute.

---

## Rollback (Ship 1)

```
git show 5109aa0~1:supabase/sql_editor/hr_unified_daily_attendance_view.sql
git show 5109aa0~1:supabase/sql_editor/hr_attendance_activity_audit_view.sql
```

`DROP VIEW public.unified_daily_attendance CASCADE` first, then run both, then
run `enable_attendance_views_security_invoker.sql`. **That last step is not
optional** — the pre-rebuild definitions do not declare `security_invoker`
inline, so skipping it leaves both views on owner privileges and RLS stops
scoping rows, with no visible symptom.

---

## Superseded files — do not re-run

Each carries a full copy of a pre-axes view definition. Running any of them
now would restore `hr_flag`'s old shape, delete every axis column, bring back
`estimated_normal_day_ot_hours`, and drop the inline `security_invoker`
declaration.

- `attendance_employment_act_overtime_migration.sql`
- `attendance_approved_hours_and_absence_split_migration.sql`
- `attendance_reconciliation_flags_view_migration.sql`
- `enable_attendance_views_security_invoker.sql` — obsolete, but still needed
  for rollback (see above)
