# Leave Type Auto-Create, Leave Types Tab, and Retiring Absence Acknowledgement — Deployment Guide

Everything in `supabase/` is hand-run in the Supabase SQL editor; editing a
`.sql` file in this repo does **not** change production.

Three changes, all from the same realisation: **every unexcused absence ends up
in HR2000 as an NPL entry**, so the leave sync — not the portal — is what
resolves an absent day.

| Part | What it changes | Files |
|---|---|---|
| 1 | The leave sync auto-creates unknown leave type codes instead of aborting the whole upload | `sync_leave_ledger_rpc.sql` |
| 2 | HR can classify those auto-created types, in a new Leave Types tab | `leave_ledger_crud.sql` + frontend |
| 3 | Absences can no longer be acknowledged | `acknowledge_attendance_day_rpc.sql`, `attendance_reconciliation_acknowledgements_migration.sql`, `payroll_reconciliation_glossary_migration.sql` + frontend |

Parts 1+2 are one unit — **do not deploy Part 1 without Part 2.** Part 1
auto-creates types defaulting to *paid*, and Part 2's tab is the only place
that default can be corrected. Part 3 is independent of both and can be
deployed before or after.

---

## Run order

Run each file as **one whole paste**, in this order. The Supabase SQL editor
returns only the **last statement's result**, so pasting a file shows you only
its final statement — that is expected here, since none of these files end in
a verification query.

| # | File | Why this order |
|---|---|---|
| 1 | `supabase/policies/leave_ledger_crud.sql` | Grants HR INSERT/UPDATE on `leave_ledger_types`. Must land **before** the tab is usable. Re-runnable — every policy is now `drop policy if exists` first. |
| 2 | `supabase/sql_editor/sync_leave_ledger_rpc.sql` | `create or replace function`. Safe to run any time; takes effect on the next import. |
| 3 | `supabase/sql_editor/attendance_reconciliation_acknowledgements_migration.sql` | Retires the four absent-only reasons. Must land **before** #4, so no reason is left active for a category the RPC is about to reject. |
| 4 | `supabase/sql_editor/acknowledge_attendance_day_rpc.sql` | `create or replace function`. The authoritative gate. |
| 5 | `supabase/sql_editor/payroll_reconciliation_glossary_migration.sql` | Rewords the `absent` employee-action text, which still told people to acknowledge. |

Every one of these is idempotent. #1 drops and recreates its policies; #2 and
#4 are `create or replace function`; #3 and #5 are `create table if not
exists` + `on conflict do nothing` inserts, each followed by an explicit
`update` that is a no-op once applied.

**Nothing here drops a column, a view, or a table.** The acknowledgement table,
its `category` column and the view's `is_unacknowledged_*` columns are all left
intact — see "What was deliberately NOT changed" below.

---

## Part 1 — Sync auto-creates unknown leave types

### What changed

`unrecognized_leave_type_code` is no longer a structural error. Previously one
unknown code in the CSV raised:

> Leave sync rejected: N row(s) failed structural validation — fix the source
> export and re-upload; nothing was written

…and aborted the **entire** upload. `leave_ledger_types` was SELECT-only, so
there was no way to add the missing type from the portal either: the moment
HR2000 introduced a code the portal had not seen, leave sync stopped and stayed
stopped, with nothing in the app able to unblock it.

Now the sync inserts any unseen code in the same transaction, with
`on conflict (code) do nothing` so concurrent syncs cannot collide, and returns
the created codes as `createdLeaveTypes` in the result.

Defaults for an auto-created type: `is_paid = true`,
`needs_hr_confirmation = true`, `is_active = true`, `label = code`.

### The `is_paid = true` default is a deliberate trade

Most leave types are paid, so it is right more often than not. But a new
**no-pay** type counts as paid until someone reclassifies it, which overstates
`paidLeaveDaysTotal` and understates `unpaidLeaveDaysTotal` in the payroll
package. `needs_hr_confirmation = true` plus Part 2's tab is what bounds that
exposure. **Without the tab, this default is unsafe** — hence the "do not
deploy Part 1 without Part 2" rule above.

### It creates types on a DRY RUN too

This is intentional and worth knowing before someone reports it as a bug.
`_resolved` INNER JOINs `leave_ledger_types`, so the types must exist before
the dry run can report what a real run would do. A dry run therefore leaves
new type rows behind even though it writes no entries. They are harmless
(flagged, unreferenced) and the real run reuses them.

### Unchanged

The 70% shrink guardrail, the full-snapshot delete, and the HR/superadmin
authorization. A bad **date** or a bad **day fraction** is still a hard reject —
those are malformed data, not new vocabulary.

### Verification

1. Import a CSV containing a leave code that does not exist. It must
   **succeed**, create the type, and report it in `createdLeaveTypes`.
2. Re-import the same file: no duplicate type, no error.
3. Import a CSV with a genuinely malformed date or fraction — must still hard-
   reject, proving only the vocabulary check was relaxed.
4. Truncate an export to under 30% of the current row count and confirm the
   shrink guardrail still fires.

---

## Part 2 — Leave Types tab

### Policies

`leave_ledger_crud.sql` gains `"HR can add leave types"` (INSERT) and
`"HR can update leave types"` (UPDATE) on `leave_ledger_types`, for
`department_id = 7` or superadmin.

**No DELETE policy, deliberately.** `leave_ledger_entries.leave_type_id`
references this table, so deleting a type in use fails on the FK — and deleting
an unused one only invites the next sync to recreate it from the source file.
`is_active = false` is the retirement path.

The open SELECT is unchanged. The file explains why it must stay unrestricted:
restricting it would null out the embedded `leave_type` join on otherwise-
visible leave rows.

This file was **not re-runnable before this pass** — it would fail with
`42710: policy "..." already exists`. All seven policies are now
`drop policy if exists` first.

### The ENTRIES / TYPES distinction

Worth stating plainly, because the two tables sit next to each other and the
rule is opposite:

- **`leave_ledger_entries` is read-only, forever.** It is a full snapshot of
  HR2000. Any edit would be discarded by the next sync.
- **`leave_ledger_types` is HR-writable.** `is_paid` and
  `needs_hr_confirmation` are two fields HR2000 never sends, and the sync only
  ever looks types up by `code`.

### Frontend

Leave Management was a single untabbed page at `/app/hr/leaves`. It is now
tabbed, the same shape as Attendance Management:

- `/app/hr/leaves` → redirects to `records`
- `/app/hr/leaves/records` → the existing page, unchanged
- `/app/hr/leaves/types` → new

`code` is editable **only on create**. It is the key the sync matches on
(`lt.code = v.leave_type_raw`), so renaming it would orphan every entry that
used the old spelling AND make the next sync auto-create the original code
again as a second, unclassified type — a rename quietly produces a duplicate
rather than a correction. The UI enforces this and
`leaveTypesService.updateLeaveType` strips `code` as a backstop.

The list sorts `needs_hr_confirmation` first, which is what turns the tab into
a review queue rather than a flat lookup list.

### Verification

5. As HR: create, edit, toggle `is_paid`, deactivate. As a plain employee: the
   tab must be unreachable and a direct write must fail.
6. Flip a type's `is_paid` and confirm `paidLeaveDaysTotal` /
   `unpaidLeaveDaysTotal` on Payroll Export move accordingly — **that is the
   whole point of the tab.**
7. Auto-created types appear at the top, flagged for confirmation.

---

## Part 3 — Retiring absence acknowledgement

### Why

Acknowledging an absence never changed a pay figure. `acknowledged +
unacknowledged` always summed to `daysAbsentCount`, and payroll deducts in
HR2000 regardless.

What it *did* do was let someone close the review **without the record ever
reaching HR2000** — a second, weaker source of truth for a day that has a real
one coming. Every unexcused absence ends up there as NPL, and the weekly leave
sync turns that into an `on_leave` day that clears the flag on its own.

**`insufficient_half_day` acknowledgement stays.** It has no HR2000
equivalent: the leave fraction and the hours are both already correct, the day
just looks short. There is nothing to record upstream, so acknowledging is the
only sensible close — and its single reason, "Hours Reviewed and Accepted",
says exactly that.

### What changed

| Layer | Change |
|---|---|
| `acknowledge_attendance_day` | Rejects `p_category = 'absent'` with a hint naming the alternative. The self/manager authorization branch went with it — `insufficient_half_day` was always HR/superadmin-only. |
| `revoke_attendance_day_acknowledgement` | **Still accepts `'absent'`**, deliberately — see below. |
| Acknowledgement reasons | `no_show`, `notified_no_leave`, `sick_no_mc`, `unpaid_leave_agreed` set `is_active = false`. `other` narrowed to `['insufficient_half_day']`. |
| Glossary | The `absent` employee-action text no longer instructs the employee to "confirm it is a genuine unexcused absence". |
| `AttendanceSidebarHR.jsx` | The `category="absent"` panel mount removed. The half-day mount stays. |
| `AcknowledgeDayPanel.jsx` | Category branching collapsed; copy rewritten for short hours. |
| Payroll Export | `acknowledgedAbsenceCount` column removed from the table **and the CSV**; `"Absent - Confirmed Unpaid"` filter option and its `confirmedAbsence` predicate removed; the KPI card relabelled "Outstanding Absences". |

### Why revoke still accepts `'absent'`

Closing an absence this way is no longer allowed, but any row written before
this deploy must still be clearable — otherwise removing the feature would
strand its own leftovers permanently suppressed. The table held **0 rows** at
the time, so this is belt-and-braces rather than a migration.

### The CSV file shape changed

`exportConfig.js` lost its "Confirmed Unpaid Absences" column. This **breaks
anything already consuming the downloaded CSV by column position.** It was
removed rather than kept-at-zero on the grounds that the app is still in
testing, and that a permanently-zero column reads as "no confirmed absences"
rather than "this no longer exists". If something downstream already depends on
the old shape, this is the one item in this pass worth reversing.

`unacknowledgedAbsenceCount` is **kept everywhere it appears.** It now always
equals `daysAbsentCount`, but it is *accurate* — every absence is genuinely
unresolved until HR2000 clears it — and it carries the red/green urgency the
plain count does not.

### Verification

8. An absent day offers **no** acknowledge action, in the HR sidebar and in the
   employee's own view.
9. Calling the RPC directly with `'absent'` is rejected with the HR2000 hint.
10. A half-day short-hours day still acknowledges, still drops out of Needs
    Reconciliation and the weekly reminder.
11. `daysAbsentCount` is unchanged for a fixed period, before and after.
12. **End-to-end, the replacement path:** add an NPL entry for a flagged absent
    day to a sync CSV, import it, and confirm the day becomes `on_leave` and
    leaves the reconciliation queue. *If this does not work, absences have no
    resolution at all.*

---

## What was deliberately NOT changed

Dropping `attendance_reconciliation_acknowledgements.category`, or the view's
`is_unacknowledged_*` columns, would mean `DROP VIEW` plus rewriting four RPCs
— a refactor with real blast radius, for a feature that is simply no longer
reachable. The plumbing stays; only the ability is removed.

The `absent` row in `payroll_reconciliation_glossary` also stays. Absence is
still a reconciliation category — it still flags, still appears in the weekly
reminder, still shows in the Payroll Export sidebar. Only its *resolution* moved.

---

## Consequence worth understanding

An absent day now has exactly **two** resolutions:

1. Attendance is added — they actually worked.
2. An NPL entry arrives from HR2000.

Until one happens, the day stays flagged and the employee keeps receiving the
weekly reminder.

That is the intent — the flag now tracks a real outstanding item rather than an
unreviewed one — but it does mean the reminder will chase days that are waiting
on an HR2000 round-trip nobody in the portal can see. **If that proves noisy,
the fix is to surface sync recency next to the reminder, not to reinstate
acknowledgement.**

---

## Related risk, not addressed here

The acknowledgement suppression predicate is implemented **four independent
times**: in the view (`is_unacknowledged_*`), in
`get_payroll_reconciliation_rows`, in `get_payroll_period_summary_rpc`, and
again in `send_payroll_reconciliation_hr_digest`. They agree today and this
change does not disturb them, but nothing enforces that they stay in step.
