# Attendance Punctuality Accuracy — Deployment Guide

Everything in `supabase/` is hand-run in the Supabase SQL editor; editing a
`.sql` file in this repo does **not** change production.

Two fixes, one file, one paste. Both are about not reporting things that did not
happen.

| # | Fix | Effect |
| --- | --- | --- |
| A | A forgotten badge-out is no longer recorded as a departure | `avgCheckOutTime` moves **later**, `earlyLeaveCount` **falls** |
| B | No late/early flag on a day that was worked in full | `earlyLeaveCount` and `lateArrivalsCount` both **fall** |

---

## Run order

**One statement. `supabase/sql_editor/hr_unified_daily_attendance_view.sql`,
pasted whole.**

It stays a `CREATE OR REPLACE VIEW` — only expressions changed, no column was
added, renamed or retyped. **No `DROP VIEW`, no `CASCADE`, so
`hr_attendance_activity_audit_view.sql` does NOT need re-running.**

If it raises `42P16`, a column was added or retyped by mistake. Re-check the
diff; do not reach for the `DROP` recipe in that file's header.

`get_attendance_dashboard_rpc.sql` was touched in the same commit but the
changes are **comments only** — two stale comments that described the old
behaviour. Re-running it is optional and changes nothing.

---

## Fix A — a single scan is an arrival, not a departure

`daily_hardware` computes `hw_check_out = MAX(scanned_at)`. On a day with
exactly **one** scan, `MAX = MIN`, so the arrival scan was being reported as the
departure. Someone who badged in at 08:45 and forgot to badge out was recorded
as having **left at 08:45**.

That day is ordinary, has evidence and no leave, so `day_state = 'worked'` and
it flowed into everything:

- `avgCheckOutTime` averaged an 08:45 arrival in as a departure
- `is_early_leave` fired — 08:45 is before every location's cutoff — so a
  forgotten badge-out was counted as leaving early on the employee's card, in
  HR's Early Leave KPI, and in the Attendance List filter

**This was already a known bug class.** `avg_hours_worked`,
`overtime_hours_total` and `employees_with_overtime_count` all carry
`evidence_quality not in ('single_scan', 'single_scan_and_open_session')` and
the RPC's own comments explain why. `avg_check_out_time` sits four lines above
them and never got the guard.

### What changed

`last_out` and `last_out_time_of_day` return **NULL** when a day's *sole*
evidence is one hardware scan:

```sql
CASE WHEN a.app_check_out IS NULL AND COALESCE(h.total_hw_scans, 0) = 1
     THEN NULL ELSE <existing MAX expression> END
```

An app check-out, or two or more scans, is unchanged.

`hw_check_out` itself is **deliberately untouched** — `MAX(scanned_at)` genuinely
*is* the last scan, it is a raw fact, and it feeds `hw_hours` and the
remote-overlap window. Only the derived "when did this person leave" column
changes.

`first_in` needs no equivalent guard: on a single-scan day it is a real arrival.

### One consumer self-corrects, one needed an explicit guard

| Consumer | How it is fixed |
| --- | --- |
| `avg_check_out_time` | **Automatically.** It already said `and last_out is not null`; that guard was simply unreachable before. Do not remove it. |
| `is_early_leave` | **Explicitly.** It rebuilds `MAX(app_check_out, hw_check_out)` from the base tables rather than reading `last_out`, because a SELECT list cannot reference a sibling output column. On a one-scan day `hw_check_out` is *not* null, so the same guard had to be restated inside the flag. |

That second row is worth remembering: **anything in this view that restates the
`MAX(...)` expression instead of reading `last_out` does not inherit the fix.**

---

## Fix B — no flag on a day worked in full

`is_late_arrival` (fixed `09:00`) and `is_early_leave`
(`COALESCE(wl.early_leave_time, '17:00')` — KL 17:00, Meru 17:30) were purely
clock-time tests.

But `overtime_hours` is purely **duration**-based, and
`docs/hr/PAYROLL-DATA-REQUIREMENTS.md`'s "Overtime hours" row is explicit that
*"an early arrival earns overtime exactly like a late departure"*.

So someone in at 07:00 and out at 16:00 had worked a 9-hour span — 8 paid hours,
the whole contractual day, enough to start earning overtime if they went further
— and was still flagged for leaving early. Someone in at 09:30 and out at 18:30
was flagged late on a day they worked in full.

Both flags now additionally require the day to have **fallen short**:

```sql
AND GREATEST(0, <hours_worked expr> - 1) < 8
```

i.e. `true_hours_worked < normal_hours_threshold`, restated inline for the same
sibling-alias reason.

### This does not make the work-location cutoff redundant

HR confirmed (same doc) that **KL's 17:00 finish is company leniency, not a
shorter contractual day** — both sites owe the same 8 paid hours, a 9-hour span
with the unpaid lunch inside it. So:

- the cutoff answers *"did they leave before we allow?"*
- the new guard answers *"and did they come up short?"*

A day needs **both** to be flagged. A genuinely short day (in at 09:30, out at
17:00 → 6.5 net hours) still flags, which is the case the KPI is actually for.

### Fixed in the view, not in the KPI

Deliberate, following the precedent set when the leave guard was added on
2026-09-23. These columns drive the red badge on the attendance card, the day
sidebar, the dashboard KPI **and** the Attendance List filter
(`attendanceOverviewService.js`). They previously disagreed — the KPI filtered
leave days out, the badge did not — and were unified here for exactly this
reason.

---

## Fix C — four list filters were still querying the dropped `hr_flag` column

Found while testing Fix B: the Attendance Overview KPI cards deep-link into the
Attendance List, and the **Late Arrivals** and **Early Leave** tiles both
errored with "error loading list".

Not caused by this pass. `applyAttendanceFilter` in
`src/features/hr/attendance/private/api/attendanceOverviewService.js` still
referenced `hr_flag`, which was **dropped from the view in Ship 3**, so
PostgREST returned a 400 and the page never loaded. Four filters were affected —
two were reported, two had simply not been clicked yet:

| Filter | Was | Now |
| --- | --- | --- |
| `lateArrival` | `.eq(is_late_arrival,true).eq(is_weekend,false).neq(hr_flag,"Absent")` | `.eq(is_late_arrival, true)` |
| `earlyLeave` | same shape | `.eq(is_early_leave, true)` |
| `overtimeOnly` | `.gt(overtime_hours,0).eq(is_weekend,false).neq(hr_flag,"Absent")` | `.gt(overtime_hours, 0)` |
| `presentOnly` | `.neq(hr_flag,"Absent").not(hr_flag,"ilike","Public Holiday%")` | `.neq(evidence_source, "none")` |

**The first three had their guards removed rather than translated, because the
guards were already redundant** — and provably so:

- `is_late_arrival` / `is_early_leave` are each `NOT is_weekend AND no holiday
  AND no leave AND <threshold>`, and the threshold needs a real `first_in` /
  `last_out` to compare against, so a day with no attendance can never match.
- `overtime_hours` is forced to 0 on weekends and public holidays by the view,
  and a day with no attendance has no hours to exceed 8.

Worth recording: `overtimeOnly`'s own comment described these as
*"redundant-but-harmless ... kept for consistency with the neighbouring cases."*
They were not harmless — that consistency is exactly what copied a dead column
into four call sites at once, where one would have been caught sooner.

`presentOnly` needed a real translation, and got simpler for it.
`evidence_source <> 'none'` says "something told us this person was here", on
any kind of calendar day — replacing two string tests plus a paragraph
explaining why `is_weekend` must *not* be excluded (a worked Saturday is still
present) and why the `"Public Holiday%"` prefix was safe.

**Frontend only. Nothing to run in Supabase for this fix.**

### Filter labels renamed in the same pass

The option labels stated thresholds the filters no longer apply:

| Was | Now |
| --- | --- |
| "First In After 9:00 AM" | **"Late Arrival"** |
| "Last Out Before 5:00 PM" | **"Early Leave"** |

Changed in all three list pages (`hr/attendanceManagement/list`,
`employee/attendance/list`, `employee/teamAttendance/list`). Stating a threshold
the filter does not apply is worse than stating none: neither flag fires on a
day worked in full, the early-leave cutoff is per work location (so "5:00 PM"
was only ever right for KL), and early leave now also skips single-scan days.

The two Attendance Overview KPI tooltips were rewritten for the same reason —
they still described the exclusions in `hr_flag` terms ("Weekend/Rest-Day and
Absent records excluded") and called the early-leave cutoff "a fixed
company-wide assumption".

---

## Known, deliberately NOT fixed in this pass

**`is_early_leave` is work-location aware; `is_late_arrival` is not.**
`work_locations` has an `early_leave_time` column (KL 17:00, Meru 17:30) but no
`late_arrival_time` at all, so "late" is a hardcoded company-wide 09:00.

This is a documented gap, not an oversight —
`docs/PORTAL-PURPOSE-AND-DEPARTMENT-VALUE.md:148` records that no per-employee
shift/schedule table exists anywhere in the system. Adding the column is a
sibling-repo schema change (`hyrax-data-platform`) and belongs with real shift
data, not here.

**Also verified and correct, no change needed:** `avgCheckInTime` /
`avgCheckOutTime` are restricted to `day_state = 'worked'`, which only ever
occurs on an ordinary day with `leave_state = 'none'`. Weekends become
`weekend_worked`, public holidays `public_holiday_worked`, half-day leave
`on_leave_partial` / `insufficient_half_day`, full-day leave plus attendance
`leave_conflict`. Weekends, holidays and every flavour of leave are **already
excluded by construction**.

---

## Verification

### Before — capture these, so the movement is provable

1. For one **closed** month: `earlyLeaveCount`, `lateArrivalsCount`,
   `avgCheckInTime`, `avgCheckOutTime`.
2. **Days with a fabricated departure** — this is exactly how many Fix A
   corrects:

   ```sql
   select count(*) from public.unified_daily_attendance
   where work_date between :start and :end
     and day_state = 'worked'
     and evidence_quality in ('single_scan', 'single_scan_and_open_session');
   ```

3. **Days that lose a flag to Fix B:**

   ```sql
   select count(*) filter (where is_late_arrival) as late_days,
          count(*) filter (where is_early_leave)  as early_days
   from public.unified_daily_attendance
   where work_date between :start and :end
     and (is_late_arrival or is_early_leave)
     and true_hours_worked >= 8;
   ```

Prefer a range that **ends before today** — today is still accumulating badge
scans, so a day with one scan so far will legitimately gain a second.

### After

4. **Zero fabricated departures.** Must return 0:

   ```sql
   select count(*) from public.unified_daily_attendance
   where last_out is not null and app_check_out is null and total_hw_scans = 1;
   ```

5. **`avgCheckOutTime` moves LATER.** Moving earlier means the guard did not
   take.
6. **`earlyLeaveCount` falls by roughly (2) + (3).** Reconcile the two causes
   separately — they are independent and should be separable.
7. **`lateArrivalsCount` falls by the late-arrival portion of (3) only.** Fix A
   must not affect it at all, since `first_in` is untouched.
8. **`avgHoursWorked` and `overtimeHoursTotal` are IDENTICAL to baseline.**
   Neither fix touches `hours_worked`. Any movement means an edit landed in one
   of its 11 textual repetitions by mistake — that expression is copy-pasted
   throughout this view because a SELECT list cannot reference a sibling alias,
   and it is the single sharpest edge in the file.

### Spot checks in the UI

9. A single-scan day: card and sidebar show a check-in, **no** check-out, no red
   "Left Early" badge, `evidence_quality = 'single_scan'`.
10. A 07:00→16:00 full-span day: **no** early-leave flag, hours intact.
11. A genuinely short day (09:30→17:00): **still** flagged late. If this one
    stops flagging, the guard is inverted.
