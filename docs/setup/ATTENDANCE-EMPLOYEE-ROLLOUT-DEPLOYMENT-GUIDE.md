# Attendance Activities — Employee Rollout Readiness (Deployment Guide)

Everything in `supabase/` is hand-run in the Supabase SQL editor; editing a
`.sql` file in this repo does **not** change production.

Prepares app attendance activities to go from HR-only to all KL employees plus
all HR staff. Meru staff have no portal accounts, so HR creates their activities
on their behalf — making HR-on-behalf entry a first-class path.

Two halves, and **the order between them is the point**: the security gate
first, because evidence attached to a forgeable record proves nothing.

---

## Part 1 — The security gate

### What was wrong

**Any employee could self-approve, via REST, using the anon key the app already
ships to their browser.** The live policies on `attendance_activities`
constrained _only_ `employee_id = me` — no column guard, no trigger. One `PATCH`
set `approval_status = 'Approved'`, `approved_by = <self>` and any clock times,
and `approve_attendance` was never consulted. That feeds `hours_worked` →
`overtime_hours` → the statutory rate tiers → the payroll handoff, with no error
anywhere.

It also nullified the guarantee `create_attendance_backfill_rpc.sql:33-35`
explicitly claims — _"a crafted request cannot self-approve"_ — true of that
RPC, false of the table.

**Any authenticated user could read, overwrite or delete any employee's
attendance photo.** Four Studio-generated `vdno4p_*` policies checking only
"is authenticated", with no per-employee scoping. The fix has been sitting
written and undeployed in `attendance_photos_storage_fix.sql`.

Two independent audits found both.

### Run order

| #   | File                                                                    | Notes                                                                                                            |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `supabase/policies/attendance_photos_storage_fix.sql`                   | Already written, idempotent. Highest risk, zero dependencies — run it first.                                     |
| 2   | `supabase/policies/attendance_activities_crud.sql`                      | **New.** There was no policy file for this table at all, though two design docs cite one as the pattern to copy. |
| 3   | `supabase/functions/approve_attendance.sql`                             |                                                                                                                  |
| 4   | `supabase/functions/reject_attendance.sql`                              |                                                                                                                  |
| 5   | `supabase/sql_editor/attendance_activities_open_session_constraint.sql` | **Run its pre-flight query first** — see below.                                                                  |
| 6   | `supabase/functions/auto_clock_out.sql`                                 |                                                                                                                  |
| 7   | Frontend deploy                                                         |                                                                                                                  |

**Step 5 will fail if duplicates already exist.** Run this first and resolve
anything it returns:

```sql
select employee_id, count(*) as open_sessions,
       min(clocked_in_at) as oldest, max(clocked_in_at) as newest
from public.attendance_activities
where clocked_out_at is null
group by employee_id having count(*) > 1
order by open_sessions desc;
```

Expect some. The two causes are both fixed in this pass — the missing
double-submit guard, and `auto_clock_out()`'s timezone bug leaving every session
opened before 08:00 MYT open forever.

### What each change does

**2 — the column guard.** An employee may INSERT only with
`approval_status = 'Pending'`, `approved_by` and `approved_at` null; and may
UPDATE only _while the row is still Pending_. The `USING` half is what stops
editing after sign-off; the `WITH CHECK` half is what stops self-approval.
Both are needed — either alone leaves a usable path. Because RLS `WITH CHECK`
evaluates against the NEW row, no trigger is required.

It also adds a **restrictive** policy — ANDed with every other tier rather than
ORed — saying nobody may approve their own attendance. That matters because
`HR CRUD` and `Only Managers can CRUD Team Attendance` are both `ALL`, so an HR
user or a manager could otherwise self-approve by direct `PATCH`, routing
around the RPC guard entirely.

The file also captures the elevated tiers verbatim, so it is the whole picture
rather than a patch. **If you change one of those, change it here, not in
Studio.**

**3, 4 — segregation of duties.** Neither RPC checked that the approver wasn't
the subject, so any HR employee could approve their own row through the normal
UI. Self-_rejection_ is deliberately still allowed: rejecting your own row
removes your own hours, so there is nothing to gain, and it is the only way to
retract a row at all (there is no self-DELETE policy by design). Both functions
also move to `search_path = ''` with fully-qualified names, matching every other
SECURITY DEFINER function here, and gain `LIMIT 1` on the actor lookup.

**5 — one open session per employee.** A partial unique index. The failure it
prevents is self-amplifying, which is what made it a blocker: a double-click
creates two open rows → `AttendanceProvider`'s `.maybeSingle()` returns
`PGRST116` → the catch cleared state → the widget offered "Clock In" again →
a third row. The employee could not clock out without HR editing the table.
Also adds a `NOT VALID` check that `clocked_out_at >= clocked_in_at`.

**6 — `auto_clock_out()` timezone.** It compared UTC dates against a MYT
business day, so **a session started before 08:00 MYT was never closed by either
sweep.** Already self-documented as an open bug at
`attendance_day_model_axes_migration.sql:82-87`. The function also becomes
SECURITY DEFINER with a guard and loses its default `EXECUTE TO PUBLIC` — it
previously ran as invoker with no authorization, so any HR user could
force-close every open session company-wide in one REST call. `service_role` is
granted back explicitly, because the edge function calls it with that key.

**7 — the client half.** `AttendanceProvider` no longer treats a failed _fetch_
as "not clocked in" (that was the assumption inviting a duplicate).
`updateAttendanceActivity` and `clockOutAttendanceActivity` now rethrow — they
were the two outliers among five mutations, and six callers were reading their
`undefined` as success, closing sidebars and modals for writes that never
happened. Every one of those callers now handles the throw.
`useClockInOutAction` gains a `submittingRef` and both clock-in sidebars now
pass `saving`, which is the only thing that disables `DataForm`'s submit button.

---

## Part 2 — Evidence, driven by the attendance type

### The mechanism already existed and was enforced nowhere

`attendance_types.requires_photo` / `requires_notes` are real, seeded columns,
already fetched by the mutation hook — and read by nothing. `requires_photo` sat
commented out; no server-side check existed.

Meanwhile evidence capture had drifted to opposite extremes:

| Surface                                            | Before                  | After                      |
| -------------------------------------------------- | ----------------------- | -------------------------- |
| Employee live clock-in                             | photo **commented out** | type-driven                |
| HR list "Add Activity"                             | photo, always optional  | type-driven                |
| Sidebar timeline **edit**                          | photo, always optional  | type-driven                |
| Sidebar "Add Activity" / "Report Missing Activity" | none                    | **still none** — see below |
| Backfill wizard                                    | none                    | **still none** — see below |

A photo was collected where it proves least — HR editing a record after the
fact — and never where it proves most: the live capture moment, and
self-asserted rows that land `Pending` for a manager to approve with nothing to
look at.

### How it works now

`src/functions/attendanceEvidenceRules.js` is the single place that answers
"does this activity need a photo / notes?". Each form declares
`required: evidenceRequired(attendanceTypes, "requires_photo")` — a **predicate**,
not a boolean.

That needed one generic change: `EditableField` now resolves `col.required` as a
function of the form's live values, the same treatment `col.options` already
got. Without it a requirement cannot depend on a sibling field chosen in the
same form — which is exactly why `attendanceActivityConfig`'s old
`selectedType?.requires_location` had silently never worked: the config took a
`selectedTypeId` parameter that no caller ever passed.

**The live clock-in form also gained the upload step** it would have needed the
moment the photo field was enabled — without it, `ImageUploadEditor`'s staged
`File` would reach PostgREST and serialize to `"{}"`, reproducing a bug that
already happened once on the timeline edit form.

### Nothing changes until HR turns a flag on

**Every type ships `requires_photo = false` and `requires_notes = false`.** The
photo field renders as an optional "Take Photo" button everywhere. Behaviour is
identical to today — which makes verification step 7 a clean regression gate,
and keeps the policy decision separate from the code change.

Suggested starting point when HR does decide, to be confirmed: off-site types
(Site Visit, Business Meeting, Work From Home, Local/Overseas Trip, Training)
require a photo; `Office` and `Blending Plant` do not, since the badge scanner
already proves presence there.

### Not done, and why

**The two RPC-backed surfaces still capture no photo** — the sidebar's
"Add Activity" / "Report Missing Activity" (`dayActions/AddActivityForm.jsx`)
and the backfill wizard. Both commit through `create_attendance_backfill`, whose
row contract has **no photo parameter at all**, so this needs the RPC changed
rather than a config edit. It is the larger remaining piece of the evidence
story, and it is the one covering the case with the clearest conflict of
interest: an employee asserting their own past attendance.

**Server-side enforcement of `requires_*` is likewise not in yet**, for the same
reason — the natural home is that RPC, alongside the existing adjustment-reason
check whose own comment explains why the form alone is not enough:

> `requires_notes` is enforced here, not only in the form: the client-side
> column config can express "always required" but not "required only when
> reason = other".
> — `create_attendance_backfill_rpc.sql:204-210`

Until both land, Part 2 is a UX affordance, not a control.

---

## Verification

### The two blockers — test them as attacks, not as features

1. As a **plain employee**, in the browser console with the session the app
   already holds: `PATCH` your own row setting `approval_status = 'Approved'`.
   **Must be refused.** Repeat with an INSERT of a pre-approved backdated row.
   _This is the single most important check here — it is currently a two-line
   exploit._
2. As a plain employee: `storage.list('attendance', 'photos/<someone-else>')`,
   then attempt a fetch, an overwrite and a delete. **All must fail.**
3. Re-export `docs/portal/TABLE-POLICIES.csv` and confirm the four `vdno4p_*`
   rows are gone and the new `attendance_activities` policies are present.
4. As an HR employee, approve **your own** pending row. Must be refused. Then
   reject your own row — that must still work.

### Integrity

5. Two rapid clock-ins: the second fails on the constraint rather than
   duplicating. Then confirm the widget still offers **Clock Out**, not Clock In.
6. Clock in at 07:30 MYT, leave it open, run `auto_clock_out()`. Must close.
   (Today it never does.)
7. Force a write failure on an activity edit — the sidebar must **stay open**
   with an error, not close as though saved.
8. Call `auto_clock_out()` as an ordinary authenticated user. Must be refused.
   Then confirm the nightly edge-function run still works.

### Evidence

9. **Regression gate:** with all `requires_*` still `false`, every surface
   behaves exactly as before, except the live clock-in now shows an optional
   "Take Photo" button.
10. Take a photo on a live clock-in and confirm `photo_url` stores a real URL
    and `photo_path` a path — **not** `"{}"`.
11. Set `requires_photo = true` on one type. Submission without a photo must be
    blocked on the live clock-in, HR's Add Activity form and the timeline edit
    form; other types unaffected. The two RPC-backed surfaces will **not**
    enforce it — expected, see "Not done" above.

---

## Still open after this pass

- **Evidence on the RPC-backed surfaces**, and server-side `requires_*`
  enforcement (above). The largest remaining gap.
- **No DELETE audit trail.** `attendance_activity_audit` is a _view_ over live
  rows, so deleting an activity erases its own audit entry in the same
  statement. HR, superadmin **and any manager for any direct report** can delete.
- **`deactivate_profile` does not revoke auth**, so a departed employee with a
  live token keeps every right above.
- **The `attendance` bucket is undeclared in this repo** and public — its public
  flag, mime allowlist and size limit are untracked. A photo URL, once leaked,
  is readable with no authentication at all.
- **Orphaned storage objects** — upload precedes the row write, and
  `deleteAttendancePhoto.js` is called by nothing.
- **Dead files duplicating live logic**: `AttendanceActivityClockin.jsx` has no
  importer; `attendanceActivityApprovalConfig.js` is unreferenced and contains an
  **editable `approval_status` select** — harmless unused, dangerous if wired up.
- **No period lock/freeze**, so past payroll figures still move retroactively.
- **Device/GPS location.** `requires_location` stays dead data.
