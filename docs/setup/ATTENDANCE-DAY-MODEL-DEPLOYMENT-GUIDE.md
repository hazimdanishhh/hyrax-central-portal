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

## 2. Ship 1b — attendance performance

**Resolved for normal use. One case remains open — see "Still slow" below.**

### What was wrong

Attendance pages took 3–5 s, and a year-to-date filter returned
`57014 canceling statement due to statement timeout`.

The diagnostics were misleading at first, and it is worth recording why:
`EXPLAIN ANALYZE` in the Supabase SQL editor runs as the **table owner, and
owners bypass RLS**. It reported ~250 ms for the same query the app took 5 s
on. The entire gap was RLS, which the editor never evaluated.

Three separate causes, each fixed in its own canonical file:

| # | Cause | Fix | File |
|---|---|---|---|
| 1 | `is_superadmin()` and `current_employee_id()` had **no volatility marker**, so Postgres defaulted them to `VOLATILE` — which cannot be hoisted, so they ran **once per row**. Used in 22 and 11 policies respectively, each running its own query. | Declared `stable` | `supabase/functions/is_superadmin.sql`, `current_employee_id.sql` |
| 2 | Two of `attendance_logs`' five policies were **correlated** — they referenced `attendance_logs.employee_id` inside the `EXISTS`, so no volatility marker could help; they were re-evaluated per row. | Restated as uncorrelated scalar/set so Postgres computes them **once** as an InitPlan, then applies a plain equality or hash lookup per row | `supabase/policies/attendance_logs_crud.sql`, `mgm_hr_reports_access_fix.sql` |
| 3 | `daily_hardware` was referenced **twice**, so Postgres materialized it in full before any date predicate could reach it — **every** query, even a single-day one, aggregated all 51,963 `attendance_logs` rows. | `daily_hw_remote_overlap` now takes the scan bounds from a `LATERAL` against `attendance_logs` (driven by `attendance_activities`, tens of rows) instead of joining the CTE, leaving `daily_hardware` referenced once and therefore inlinable | `supabase/sql_editor/hr_unified_daily_attendance_view.sql` |

Measured before any of it: `CTE daily_hardware -> HashAggregate (actual
time=82.8..90.7 rows=10534) -> Seq Scan on attendance_logs (rows=51963)`.

**Result:** small and paginated fetches are fast. Cause 1 alone fixed small
fetches; cause 2 fixed the rest of the per-row cost; cause 3 removed the scan.

### ALSO SLOW — dashboard RPCs time out on large periods (OPEN)

`get_attendance_dashboard` and `get_hr_reports_dashboard` time out on
year-to-date and similar. Short periods are fine.

**Not the same cause as the list pages.** There is no pagination here. Both
RPCs materialize the view **twice**:

```sql
period_rows      as materialized ( ... where work_date between <period> )
prev_period_rows as materialized ( ... where work_date between <prior period> )
```

`prev_period_rows` exists to produce the "vs previous period" deltas. So a
year-to-date request materializes ~265 days for the period plus ~265 more for
the preceding one — roughly **530 days** of view computation, ~38,000 rows.
Short periods are fine because both halves are small.

**Candidate fixes, cheapest first:**

1. **Skip `prev_period_rows` past a range threshold.** Roughly halves the
   cost, and the comparison it feeds is close to meaningless for YTD — the
   "previous period" is then the preceding nine months. Small and contained.
   Unknown whether it alone clears the timeout; needs measuring.
2. **Cap the selectable period**, same reasoning as the list pages.
3. **Materialize the day grain** — a table refreshed on scan ingest rather
   than a view recomputed per request. This is the real fix for both this and
   the list-page problem, and it is the only one that scales. It is also a
   project in its own right: staleness policy, refresh trigger, backfill, and
   a correctness gate against the live view. Do not improvise it.

**Deliberately deferred** rather than fixed mid-refactor: the day-model work
has just changed several KPI predicates, and entangling those with a
performance rewrite would make both harder to verify. Normal periods work.

### STILL SLOW — large date ranges, ~6 s (OPEN)

Year-to-date and other large periods still take ~6 s. This is a **different
problem** from the three above, and none of those fixes addresses it.

**Cause: OFFSET pagination over a computed view.** Year-to-date is ~72
employees × ~265 days ≈ **19,000 rows**. The lists use `LIMIT/OFFSET` with an
`ORDER BY`, so Postgres must compute **the whole 19,000-row result and sort
it** before returning 20. The next page recomputes all of it — which is why
paging costs the same as the first load rather than getting cheaper.

The view cannot be indexed out of this: it is computed per query, and the sort
key (`full_name`, then `work_date`) spans a cross join that does not exist
until the query runs.

**Candidate fixes, roughly by value:**

1. **Keyset pagination** instead of `OFFSET` — `WHERE (full_name, work_date,
   employee_uuid) > <last row seen>`. Each page then costs one page rather
   than the whole range. The sort is already deterministic and total
   (`applyAttendanceSort` appends `employee_uuid` precisely so offset
   pagination cannot skip or repeat), so the keyset tuple is already
   available. Biggest win, and it makes paging O(page) forever.
2. **Cap the Search-mode range**, or warn past some threshold. Nobody reads
   19,000 rows twenty at a time — they filter. A cap turns an unbounded query
   into a bounded one and costs nothing to implement.
3. **Materialize the day grain.** A table refreshed on scan ingest, rather
   than a view recomputed per request. The largest change by far, and it
   introduces staleness, so only worth it if 1 and 2 prove insufficient.

**Do not** respond to this by turning `security_invoker` off. RLS is what
scopes these views per user; the cost is the price of it working.

---

## 3. Ship 2 — migrate consumers onto the axes

**No SQL to run.** Ship 1 already deployed every column these batches read;
this is frontend and RPC code only, so each batch is a normal deploy of the
app. `hr_flag` stays live throughout, so nothing breaks if a batch is late.

Batches are ordered so each one only depends on those before it.

| Batch | Contents | Status |
|---|---|---|
| 2.1 | Shared vocabulary + colours | **DONE** (uncommitted) |
| 2.2 | The three attendance lists — filters, sort, tabs, cards | **DONE** (uncommitted) |
| 2.3a | Charts moved to `day_state` (SQL + 4 overview pages) | **DONE** (uncommitted) |
| 2.3b | Dashboard KPI predicates off `hr_flag` | **DONE** (uncommitted) |
| 2.4 | Payroll Export + its RPCs + the reconciliation sidebar | **DONE** |
| 2.5 | Forms, settings, working-days card | **DONE** |

### Batch 2.1 — shared vocabulary (done)

`src/functions/attendanceDayState.js` is the single source for every axis
column's user-facing wording and colour: the 15 `day_state` values grouped for
the filter dropdown, plus `evidence_quality`, `approval_state`,
`evidence_source`, `day_calendar_type` and `leave_state`.

Everything downstream must read from it rather than hardcoding strings. This
is not stylistic — `hr_flag` accumulated **four** different spellings of "leave
conflict" and **three** of "unacknowledged absence" precisely because each
surface wrote its own, and a filter option whose value does not match a real
column value returns nothing with no error anywhere.

`chartColors.js` gains `ATTENDANCE_DAY_STATE_COLORS`,
`ATTENDANCE_EVIDENCE_QUALITY_COLORS` and `ATTENDANCE_APPROVAL_STATE_COLORS`,
keyed on the labels from that module so a chart segment and a StatusBox badge
for the same day always agree. `ATTENDANCE_FLAG_COLORS`,
`getHrFlagStatusType` and `getDisplayAttendanceFlag` are marked deprecated but
left working.

**Verified mechanically, not by eye** — all six vocabularies were diffed
against the `CASE` expressions in the deployed view, and the colour-map keys
against the module's own labels:

```
day_state          view=15 js=15  MATCH
evidence_quality   view=5  js=5   MATCH
approval_state     view=4  js=4   MATCH
evidence_source    view=4  js=4   MATCH
day_calendar_type  view=4  js=4   MATCH
leave_state        view=5  js=5   MATCH
label <-> colour keys             ALL MATCH
```

Re-run those checks after editing either file. A drift here is silent: the
dropdown still renders, it just returns zero rows.

### Batch 2.2 — the three attendance lists (done)

**The single "Status" dropdown is gone**, replaced by four that compose:

| Filter | Column | Answers |
|---|---|---|
| Day Type | `day_state` | What kind of day was this? (15 values, grouped) |
| Data Quality | `evidence_quality` | Is the record complete? |
| Approval | `approval_state` | Has the app activity been approved? |
| Calendar | `day_calendar_type` | Working day / weekend / holiday / both |

"Worked, but only one card scan, and still pending approval" is now a query.
Under `hr_flag` it was not expressible at all — one string had to pick a single
winner among those three facts.

All four are registered in `SEARCH_MODE_FILTER_KEYS` on **all three** lists.
This is not optional: a filter key missing from that array still renders and
still applies, but leaves the page in Day mode, so it answers the question for
one calendar day instead of the selected range.

**Status tabs cut from 11 to 8**, rebuilt on `day_state`. Ten of the old eleven
duplicated a dropdown value exactly. The survivors are what people check
routinely: the four reconciliation states, "Needs Reconciliation" (all five
unresolved categories at once), the two worked-when-not-expected cases that
feed statutory pay, and pending approval.

The "Absent" tab no longer needs its paired `dayType=working` condition —
`day_state` distinguishes `absent` from `weekend` natively. That also removes a
side effect: because every tab paramKey is cleared on every tab click,
`dayType` being half of one tab's definition meant clicking **any** tab
silently reset the user's Day Type dropdown.

**Cards and the HR sidebar** now render the day-state badge plus separate
data-quality and approval badges, so a day can carry all three at once.
`isAbsentWorkingDay` in the sidebar drops from three conditions to
`day_state === 'absent'` — the weekend and holiday guards are built into the
value and can no longer be forgotten by a caller.

**Table column** is `day_state`; its `getValue` returns the label rather than
the raw value, because that is what the CSV export writes — "Weekend (Worked)"
reads in a spreadsheet, `weekend_worked` does not. **Sort** gains "Data
Quality", which was impossible before: quality values were only reachable when
no approval value had already claimed the field.

`hrFlag` and `dayType` remain accepted by the filter applier, deprecated, so
deep links already sent in emails and notifications keep resolving.

**Progress:** real (non-comment) `hr_flag` code references went from 30 files
to 18.

### Batch 2.3a — charts on `day_state` (done)

**SQL (must be deployed with the frontend, the JSON key changes):**

- `supabase/sql_editor/get_attendance_dashboard_rpc.sql`
- `supabase/sql_editor/get_hr_reports_dashboard_rpc.sql`

`hrFlagBreakdownData` becomes `dayStateBreakdownData`, and the dashboard RPC
gains `evidenceQualityBreakdownData` as a **separate** chart. Under `hr_flag`
those two competed for one field and the approval branches won, so
"Incomplete Card Scans" and "Missing App Check-Out" were almost never
reported at all.

The hand-written `LIKE` bucketing is gone. `hr_flag` needed it because
`'On Leave (AL)'`, `'On Leave (AL+MC)'` and `'Public Holiday (<name>)'` were
open-ended strings — without collapsing them, every distinct leave-type
combination rendered as its own ungrouped grey slice. `day_state` is a closed
set of 15 values, so there is nothing to collapse.

**The RPCs emit the raw snake_case value, not a display label**, and the
frontend relabels through `toLabelledBreakdown` in
`functions/attendanceDayState.js`. That keeps the wording decided in one
place; emitting labels from SQL would fork it, which is exactly how `hr_flag`
acquired four spellings of "leave conflict".

Frontend: the four overview pages (`AttendanceOverview`,
`MyAttendanceOverview`, `TeamAttendanceOverview`, `HRReports`) now read the
new key and use `ATTENDANCE_DAY_STATE_COLORS`.

### Batch 2.3b — dashboard KPI predicates (done)

Both dashboard RPCs now have **zero** non-comment `hr_flag` references.
Translations applied:

| Was | Now | Same numbers? |
|---|---|---|
| `hr_flag <> 'Absent' and not is_weekend and not is_on_leave and not is_public_holiday` | `day_state = 'worked'` | **Yes** — exactly equivalent |
| `hr_flag = 'Absent' and not is_weekend` | `day_state = 'absent'` | **Yes** — `'Absent'` already implied not-holiday and not-on-leave, so the guards were redundant |
| `not is_weekend and not is_on_leave and not is_public_holiday` | `is_expected_working_day and leave_state = 'none'` | **Yes** |
| `hr_flag <> 'Absent' and not is_weekend and first_in is not null` | `evidence_source <> 'none' and …` | **Yes** — the time guard already implied real evidence |
| `hr_flag = 'Incomplete Card Scans'` | `evidence_quality in ('single_scan', 'single_scan_and_open_session')` | **No — expect a HIGHER count** |
| `hr_flag not in ('Absent','Incomplete Card Scans') and not is_weekend and not is_on_leave` | `day_state = 'worked' and evidence_quality not in ('single_scan','single_scan_and_open_session')` | **No — expect small shifts** |

**The two that move, and why they move toward being correct:**

1. **Attendance Anomalies / Incomplete Card Scans will go UP.** `hr_flag`
   could only report `'Incomplete Card Scans'` when no app branch fired
   first — so a day with one badge scan *plus* an app activity was counted as
   `'Approved'` and its missing scan went unreported. The count was
   structurally under-reporting. `evidence_quality` is an independent axis and
   sees every such day.

2. **Average Hours Worked / Overtime Hours may shift slightly.** Two causes:
   the single-scan days newly excluded above (they contribute a false
   `hours_worked = 0`, because one scan means `MAX - MIN = 0`), and worked
   public holidays, which `day_state = 'worked'` excludes where the old
   predicate — which guarded `not is_on_leave` but not `not is_public_holiday`
   — included them. A worked holiday belongs in the holiday wage tier, not in
   an average of ordinary working days.

Also fixed while here: the **trend chart's** `avg_hours` omitted
`and not is_on_leave`, so the line averaged over leave days while the KPI tile
beside it did not. Two numbers for one metric, differing silently. They now
share a predicate.

**Capture before/after** — the user accepted that numbers may change, but you
should still see *which*:

```sql
-- BEFORE deploying the two RPC files
CREATE TABLE public._dash_baseline AS
SELECT public.get_attendance_dashboard(
    date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE, NULL, NULL, NULL, NULL
)::jsonb AS kpis;

-- AFTER -- one row per changed key
WITH after AS (
    SELECT public.get_attendance_dashboard(
        date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE, NULL, NULL, NULL, NULL
    )::jsonb AS j
)
SELECT k, b.kpis->'kpis'->k AS before_value, a.j->'kpis'->k AS after_value
FROM public._dash_baseline b, after a,
     jsonb_object_keys(b.kpis->'kpis') k
WHERE b.kpis->'kpis'->k IS DISTINCT FROM a.j->'kpis'->k;
```

Expect movement only in the anomaly count, average hours and overtime totals.
Anything else moving means a predicate changed meaning unintentionally.

### Batch 2.3c — punctuality correctness (done)

Three real logic faults found while reviewing 2.3b, all the same shape: a
metric describing a NORMAL working day was being computed over days that were
not normal working days.

**1. `is_late_arrival` / `is_early_leave` had no leave guard** — fixed in
`hr_unified_daily_attendance_view.sql`, not in the consumers, because these
columns drive the red badges on the attendance cards and day sidebar as well
as the dashboard KPIs, and the two were disagreeing (the KPI filtered leave
days out; the badge did not).

> An employee on approved **half-day AM leave** arrives after lunch — hours
> past the 09:00 threshold — and was flagged as a late arrival for taking
> leave they had been granted. The PM-leave mirror image: they work the
> morning, leave at 12:30, and are flagged for leaving early.

Any leave at all now disqualifies the normal-day thresholds, not just half
days, because the expected shift is no longer the normal one.

**2. `avgCheckInTime` / `avgCheckOutTime` averaged over the wrong days** —
they guarded weekends but not leave and not public holidays. A half-day-leave
afternoon start dragged the company average check-in later, making punctuality
look worse than it was. Now `day_state = 'worked'`, matching
`lateArrivalsCount` / `earlyLeaveCount` beside them — average check-in and
"how many were late" are two views of one question and must agree on which
days they are asking about.

**3. Trend chart subtitles hardcoded "By Day"** while the RPC switches to
weekly buckets past 60 days — so a year-to-date view presented weekly points
as daily ones. The RPC now returns `trendBucket`, and the three overview pages
label from it.

**Expect late-arrival and early-leave counts to DROP** after this. The days
that disappear are people on approved leave who were never late.

### Audited and already correct

- `dailyAttendanceTrendData` / `hoursWorkedTrendData` — exclude weekends
  **and** public holidays **and** leave, on both sides of the ratio.
- `departmentAttendanceData` — same present/roster definition as the headline
  KPI, cut by department.
- `attendanceRatePct`, `absenteeismRatePct`, `lateArrivalRatePct` — numerator
  is a strict subset of the denominator in each, so none can exceed 100%.
- `topAbsenteeismData`, `topOvertimeData`, `workChannelMixData`.

### Deliberately not guarded

- The two **breakdown charts** filter only `not is_weekend`. That is correct:
  the point of a composition chart is to show every day type, and the weekend
  exclusion exists only to stop one bucket dominating.
- `incompleteScansCount` has no weekend guard — a single scan on a Saturday is
  still a real data-quality fact. Unchanged from before; a judgement call
  rather than an oversight.

### Still assumptions, not bugs

`is_late_arrival`'s 09:00 threshold is company-wide and invented — no shift or
schedule table exists anywhere in the schema. `is_early_leave` at least reads
`work_locations.early_leave_time`. Both are documented in the view.

---

## Run order for Ship 2 (batches 2.1 – 2.3c)

SQL first, then deploy the frontend.

**Every file below is now `create or replace`.** No drops, no cascade, no
ordering hazard, nothing to run "immediately after" anything else, and all of
them are safe to re-run.

| # | File | Why |
|---|---|---|
| 1 | `supabase/sql_editor/hr_unified_daily_attendance_view.sql` | leave guard on `is_late_arrival` / `is_early_leave` |
| 2 | `supabase/sql_editor/get_attendance_dashboard_rpc.sql` | `day_state` KPIs, new chart keys, `trendBucket` |
| 3 | `supabase/sql_editor/get_hr_reports_dashboard_rpc.sql` | same |

`hr_attendance_activity_audit_view.sql` is **not** in this list — it is no
longer collateral damage from step 1, so it only needs running when it
actually changes.

### Why the views stopped using DROP + CREATE

The Ship 1 rebuild genuinely needed a `DROP`: it added columns of new types
and removed `estimated_normal_day_ot_hours`, neither of which
`CREATE OR REPLACE` can do. Once that landed, the `DROP` was pure cost —
`DROP VIEW … CASCADE` also drops `attendance_activity_audit`, so every single
deploy had to run a second file immediately afterwards and left the day
sidebar with no data source in between. Forgetting the second file removed the
sidebar entirely with nothing to say why.

**When this will stop working:** `CREATE OR REPLACE VIEW` can rewrite the
query body however it likes and can APPEND columns, but it cannot drop, rename
or retype an existing one — those raise `42P16`. A change needing any of those
restores `DROP VIEW … CASCADE` for that one deploy, followed by
`hr_attendance_activity_audit_view.sql`. It fails loudly, so this cannot go
wrong silently.

**The frontend must ship with 3–4.** The chart JSON key changed
(`hrFlagBreakdownData` → `dayStateBreakdownData`), so an old frontend against
a new RPC charts nothing.

### Batch 2.4 — payroll and reconciliation (done)

`hr_flag` now survives in exactly **one live SQL file: the view that defines
it.** Every other SQL consumer is migrated.

| File | Change |
|---|---|
| `supabase/functions/get_payroll_reconciliation_rows.sql` | `hr_flag` → `day_state` in the `RETURNS TABLE` signature and all four category branches |
| `supabase/sql_editor/get_payroll_period_summary_rpc.sql` | absent counts, working-day and actual-days-worked predicates |
| `supabase/sql_editor/get_payroll_reconciliation_detail_rpc.sql` | JSON key `hrFlag` → `dayState` |
| `supabase/sql_editor/acknowledge_attendance_day_rpc.sql` | the acknowledgement write guard |
| `supabase/sql_editor/get_attendance_backfill_prefill_rpc.sql` | output column, plus a `drop function` it was missing |
| both notification functions | their own copies of the absent predicate |
| `hr_unified_daily_attendance_view.sql` | calendar guard on `is_insufficient_half_day_hours` |

**An unresolvable state, found and fixed.** `is_insufficient_half_day_hours`
had no calendar guard, so a half-day leave recorded against a Saturday (HR2000
does not prevent this) was flagged as needing reconciliation — but
`acknowledge_attendance_day()` refused it, because its absent branch excluded
non-working days. HR could clear a Saturday *absence* but not a Saturday
*half-day*: flagged, chased, and impossible to close. Both ends now agree on
which days are eligible.

**One deliberate non-change.** `actual_days_worked_count` looks like it should
become `day_state = 'worked'`, but that would newly **exclude** a day with
half-day leave plus half a day worked, which has always counted as a day
worked. That is a payroll output, and whether a half-day counts as 1 or 0.5 is
a payroll policy question, not a refactoring one. It uses the exact equivalent
instead: `is_expected_working_day and evidence_source <> 'none'`.

**Deep links** now target the axes — `dayState=absent` (no longer needing the
paired `dayType=working`, which could be forgotten), `approvalState=pending`,
`evidenceQuality=single_scan` / `open_session`.

### Batch 2.5 — working-days card (done)

**No SQL.** The create/edit form and the settings page turned out to reference
`hr_flag` only in comments, so the batch reduced to one real defect.

`AttendanceActivityClockin`'s working-days figure counted **Mon–Fri and
nothing else** — no public holidays, no work-location scoping, in browser-local
time. The denominator behind that card could therefore never agree with any
server-side figure: every holiday in the period inflated it, making attendance
look worse than it was, and by a *different amount* for KL than for Meru.

Replaced with `countExpectedWorkingDays` in `functions/attendanceDayState.js`,
the client-side mirror of the view's `is_expected_working_day`, computed from
the same `public_holidays` rows and applying the same location rule (a holiday
counts when its `work_location_id` matches the employee's **or** is null).

**It deliberately does not read `unified_daily_attendance`.** The card's "year"
option needs a year-to-date figure, and the view currently times out over wide
ranges (section 2). `public_holidays` has tens of rows and is already cached by
`usePublicHolidays`. When the view's performance is fixed, this could read the
column directly — but it agrees with it either way, because it is derived from
the same data.

### What is left of `hr_flag`

Five frontend files, **all of them the intentional compatibility shim**:

- `attendanceOverviewService.js` — the deprecated `hrFlag`/`dayType` filter
  cases, kept so deep links already sent in emails and notifications resolve
- `attendanceFlagStatus.js` — the deprecated helper module itself
- `"hrFlag"` in three `SEARCH_MODE_FILTER_KEYS` arrays, so those old links
  still promote the page to Search mode

Ship 3 removes exactly these, then drops the column from the view.

### What changes for users, per batch

- **2.2** — the "Status" dropdown splits into *what kind of day* /
  *is the data complete* / *is it approved*. Status tabs stop silently
  clearing eight filter keys when clicked.
- **2.3** — charts break down by `day_state` instead of `hr_flag`, so weekend
  and holiday days stop being lumped in with genuine absences.
- **2.4** — Payroll Export's reconciliation categories become the same enum
  the lists use.
- **2.5** — the working-days card is sourced from the server instead of
  counting Mon–Fri in browser-local time with no holiday awareness.

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
