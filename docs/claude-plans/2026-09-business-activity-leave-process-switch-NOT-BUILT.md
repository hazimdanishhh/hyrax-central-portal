# Business-activity leave → portal attendance activities

**Status: decision record. Nothing here was built, and the code change it
replaced was deliberately rejected.** Written 2026-09-23.

## The question

`leave_ledger_types.category` splits the HR2000 leave vocabulary into
`statutory_leave` and `business_activity`:

| `statutory_leave` (9) | `business_activity` (4) |
| --- | --- |
| AL, ML, HPL, MTL, NPL, CPL, RPL, PTL, MRL | BIZZ APPOINTMENT, BIZZ TRIP / TRAVEL, TRAINING / SEMINAR, TIME OFF |

All 13 are treated identically today: a business trip counts as **leave**,
contributes **zero hours**, and is excluded from days worked. So for those days
the working-day count, the working-hours total and the leave-day count are all
wrong.

The obvious fix was to teach `unified_daily_attendance` that
`business_activity` means working time — 1.0 day = 8 hours, 0.5 = 4.

## The answer: don't. Change the process instead.

**The destination already exists.** `Overseas Trip` and `Local Trip` shipped as
`attendance_types` on 2026-09-21
(`supabase/sql_editor/seed_attendance_types_backfill_rows.sql`), both
`is_full_day = true` and `is_self_selectable = true`. `Site Visit`,
`Business Meeting`, `Work From Home` and `Training` already existed.

| HR2000 leave code | Portal attendance type |
| --- | --- |
| BIZZ APPOINTMENT | Business Meeting / Site Visit |
| BIZZ TRIP / TRAVEL | Overseas Trip / Local Trip |
| TRAINING / SEMINAR | Training |
| TIME OFF | *none — see below* |

A day recorded as an attendance activity **already** reads
`day_state = 'worked'`, already contributes hours, already is not leave. No
change to the view, the RPCs or the frontend.

So HR records business activities in the portal and stops entering them in
HR2000's leave module.

## Why the view change was rejected

1. **It duplicates a mechanism that already works** (above).
2. **A standing architectural rule forbids it.**
   `docs/hr/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md:90` — trip context
   *"must never feed back into or override the neutral, calculated attendance
   figures on `unified_daily_attendance`"*. That is the exact conflict that got
   "Overtime" removed as a self-selectable attendance type.
3. **Cost and blast radius.** ~20 SQL and frontend files. It needs new
   `day_state` values, redefines `leave_state` to mean statutory-only, and
   moves attendance rate, late-arrival rate, leave counts and conflict counts
   **retroactively across all history** — the view is computed, not
   materialised, so there is no cutover date and no backfill.

## Why auto-creating attendance activities from the leave rows does not work

A tempting shortcut: generate an `Overseas Trip` activity for every day that has
a `business_activity` leave row.

It fails structurally. `leave_ledger_entries` is a **full-snapshot mirror** of
HR2000 — the leave row does not go away, and the next weekly sync restores it
regardless. So every converted day ends up with a full day of leave *and* real
attendance, which is exactly `is_leave_attendance_conflict`
(`hr_unified_daily_attendance_view.sql:633-637`). Auto-create across history and
the reconciliation queue fills with a conflict on every single day.

The only way to stop that firing is to teach the view that a business-activity
leave row should not conflict with attendance — i.e. the ~20-file change this
was meant to avoid. **Auto-create does not save the view rewrite; it requires
it.**

Going forward the question disappears: once HR stops entering them in HR2000,
there are no rows left to auto-create from.

## TIME OFF is not a business activity

Confirmed by the user: it was an **outpatient / clinic-appointment leave**,
discontinued by HR earlier this year. Historical rows exist from early 2026; no
new ones are coming.

It should be `statutory_leave` and `is_active = false`. That leaves **three**
genuine business-activity codes.

This is invisible from the data and will be re-litigated otherwise, which is why
it is written down here.

## What was actually done

Nothing in code. The user is making the `leave_ledger_types` edits directly in
the **Leave Types tab** (shipped 2026-09-23) — that tab exists precisely so this
is a data edit, not a migration:

- TIME OFF → `statutory_leave`, retired
- `is_paid` confirmed: **NPL is the only unpaid type**
- `needs_hr_confirmation` cleared on the 13 seeded codes
- The three business-activity codes retired once HR has switched

Verified safe: `sync_leave_ledger_rpc.sql` resolves types by `code` with **no**
`is_active` filter, so historical rows keep resolving and a late straggler still
imports. `fetchLeaveLedgerTypes` (`leaveRecordsService.js:98`) does filter
`is_active = true`, so retiring only removes them from the Leave Records filter
dropdown.

## The transition protects itself

If HR records a Local Trip attendance activity **and** HR2000 still sends
BIZZ TRIP for the same day, that day has a full day of leave plus real
attendance — `is_leave_attendance_conflict`. It surfaces in the existing
reconciliation queue, on the Payroll Export row badge and in the weekly HR
digest, with no change to any of them.

**Double entry during the transition is visible by construction.**

## What this leaves unfixed

The ~9 months of existing BIZZ TRIP / TRAINING days stay counted as leave rather
than work. Nothing corrects them retroactively, and that is accepted: it is how
they were reported at the time, and it is consistent with the `On Leave` label
those same rows still carry in the list. The honest fix for that history *is*
the view change above, and it should be a deliberate decision if it is ever
wanted — not a side effect.

## Deferred, and still open

- **Overtime module** — form-based, mirroring the employees' existing paper
  form, feeding Payroll Export as the *actuals* to reconcile against the
  portal's estimates. Designed in
  `docs/hr/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md`.
- **Trip allowance / claims module** — more Finance than HR. Its weekend rules
  are already confirmed with HR: overseas weekend = **2×** daily allowance;
  local weekend = **1 day of Replacement Leave** instead.
- **The RPL write-back conflict** — granting RPL means writing into
  `leave_ledger_entries`, which the next full-snapshot sync would wipe. The
  proposed `source` column is recorded in that same doc, unconfirmed.
- **Open question, not yet answered:** should *all* weekend work grant
  Replacement Leave, or count as overtime? Several cases point different ways.

**This process switch is the prerequisite the allowance layer was waiting for.**
Once trips are attendance activities, `trip_allowance_claims` has something real
to reconcile against — "did attendance actually record an Overseas Trip on this
date?"
