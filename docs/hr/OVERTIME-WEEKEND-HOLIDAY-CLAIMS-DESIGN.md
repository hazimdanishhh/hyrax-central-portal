# Overtime / Weekend / Holiday Claims — Design (not built yet)

**Status: designed, not implemented.** Nothing in this doc exists in the database or codebase yet — no table, migration, RPC, or UI. This is a starting architecture to think against, written before HR's actual paper overtime/weekend/holiday form was available for review. Once that form is in hand, revisit the "Open questions" section below and adjust the schema before writing any migration.

## Problem

`overtime_hours`, `weekend_hours_worked`, and `holiday_hours_worked` (`hr_unified_daily_attendance_view.sql`, corrected 2026-09-15 — see `docs/PAYROLL-DATA-REQUIREMENTS.md`'s "Overtime hours" row) are **100% system-calculated from raw punches**. There is no employee submission, no manager/HR approval, and no way to reconcile the system's calculated "actuals" against HR's real process, which today is still a paper form.

This matters for payroll accuracy in both directions:

- A punch-derived number can be *wrong* for reasons the system can't see — a legitimate reason to stay late that isn't really "overtime" (e.g. waiting for a ride), or a genuine claim the punches under-represent (stepping out and back for a delivery, working from a location with no scanner).
- HR currently has no digital record to check the calculated number against — only whatever the paper form says, entirely outside this system.

**A prior, related attempt already exists and was deliberately removed**: a self-selectable "Overtime" clock-in type once let an employee mark a session as overtime at clock-in time. It was dropped (`hyrax-data-platform/infrastructure/attendance_types_cleanup_migration.sql`) specifically because it created two disagreeing sources of truth for the same concept — self-reported at clock-in vs. independently calculated after the fact. **This design must not recreate that conflict.** A claim here is a request to be *reconciled against* the calculated figure, not a replacement input that changes what `unified_daily_attendance` reports.

## Naming collision to resolve first

`src/pages/user/employee/claims/Claims.jsx` and `src/pages/user/finance/claimsManagement/ClaimsManagement.jsx` already exist as unbuilt placeholder stubs (`function Claims() { return <div>Claims</div>; }`, no feature folder, no service, no migration). Everything about their placement — Finance-owned, routed alongside expense-management pages — points to **expense/reimbursement claims**, a different concept from HR-owned overtime/weekend/holiday work claims. Don't assume these are the same feature. Recommend a distinctly-named feature area (e.g. "Overtime & Special Work Claims", under HR/Attendance) rather than repurposing the existing `Claims` stub, unless it's confirmed that stub was actually meant for this all along.

## Proposed schema (draft)

```sql
-- One row per claimed date/type. An employee (or HR, transcribing from the
-- paper form) submits a claim; a manager or HR approves/rejects it.
create table public.overtime_claims (
    id             uuid primary key default gen_random_uuid(),
    employee_id    uuid not null references public.employees(id),
    claim_date     date not null,
    claim_type     text not null check (claim_type in ('overtime', 'weekend', 'holiday')),
    claimed_hours  numeric not null check (claimed_hours > 0),
    reason         text,
    status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    submitted_by   uuid not null references public.employees(id),
    submitted_at   timestamptz not null default now(),
    reviewed_by    uuid references public.employees(id),
    reviewed_at    timestamptz,
    review_notes   text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- Google Drive attachments (e.g. a scan of the signed paper form) -- mirrors
-- documents_schema_migration.sql's Drive-reference-only shape (drive_file_id/
-- name/url/mime_type/icon_url), but simpler: a claim's supporting scan isn't
-- shared across multiple claims the way a project document can be shared
-- across tasks, so this skips task_documents' many-to-many indirection in
-- favor of a direct one-claim-to-many-attachments link.
create table public.overtime_claim_attachments (
    id            uuid primary key default gen_random_uuid(),
    claim_id      uuid not null references public.overtime_claims(id) on delete cascade,
    drive_file_id text not null,
    name          text not null,
    url           text not null,
    mime_type     text,
    icon_url      text,
    attached_by   uuid not null references public.employees(id),
    attached_at   timestamptz not null default now()
);
```

`claim_type` deliberately doesn't try to auto-derive from `is_weekend`/`is_public_holiday` on `claim_date` — the whole point of a claim is that it can disagree with what the system would have calculated (e.g. HR reclassifying a normal-day claim after review), so it's an explicit field, not computed.

## Submission UI

- Reuse the existing `GoogleDrivePicker` (`src/components/googleDrive/GoogleDrivePicker.jsx`) exactly as `TaskDocumentsEditor.jsx` (`src/components/dataTable/editors/TaskDocumentsEditor.jsx`) already does for task documents — attach one or more scanned pages of the paper form directly to the claim, with the same "list attached files + remove + pick from Drive" UX, adapted to a single claim's own attachments (no "link an existing project document" multi-select needed here, since attachments aren't shared across claims).
- A new `attendanceClaim` (or similar) editor in `src/components/dataTable/editors/Editors.jsx`'s registry, following the same pattern as `TaskDocumentsEditor`, so the claim form can reuse this codebase's standard `DataForm`/`EditableField` machinery rather than a bespoke form.
- Where this lives (employee self-service page, an HR-only transcription page, or both) is one of the open questions below — depends heavily on whether the real process has the employee filling the paper form themselves or HR filling it out on their behalf.

## Approval flow

Mirror the existing `attendance_activities` approve/reject pattern (`approve_attendance`/`reject_attendance` RPCs, already proven out for remote clock-in approvals) rather than inventing a new one: a manager or HR sees pending claims, approves or rejects with optional notes, and only `approved` claims count toward reconciliation.

## Reconciliation design

A new flag comparing each employee's **approved, claimed** hours for a period against the system-calculated `overtimeHoursTotal`/`weekendHoursWorkedTotal`/`holidayHoursWorkedTotal` (from `get_payroll_period_summary_rpc.sql`, post the 2026-09-15 formula fix) — e.g. `is_ot_claim_mismatch` when the two disagree beyond some tolerance, or when the system calculated hours but no claim was ever submitted for that date. This becomes a natural 5th reconciliation category, surfaced through the **exact same mechanism already shipped** for the existing 4 (Days Absent, Leave Conflicts, Insufficient Half-Day Hours, Leave Data Errors): `DataTable`'s `getRowFlags`/`RowFlagBadge`, already wired into Payroll Export (`payrollExport/filterConfig.js`'s `getRowReconciliationFlags`). No new UI mechanism needed — just a new flag-producing function alongside the existing one.

## Business trip attendance, allowance & Replacement Leave (added 2026-09-15)

A related but distinct concept: business trips (overseas or local) generate a **flat daily allowance**, never overtime pay, and — for weekend work during the trip specifically — either a doubled allowance or a Replacement Leave grant, confirmed as follows:

- Normal working day during either trip type: **1x** (normal) daily allowance.
- **Overseas** trip, weekend day worked: **2x** daily allowance for that day.
- **Local** trip, weekend day worked: **no** extra allowance — instead, **1 day of Replacement Leave (RPL)** is granted.
- "Travelling" itself (e.g. counting KL↔Meru inter-office travel time as work) is explicitly low priority — noted here only as a future idea, not scoped or built. The closest existing precedent is `docs/WORK-LOCATIONS-ARCHITECTURE.md`'s own already-named (also unbuilt) idea of an "employee scanned somewhere other than their assigned location today" anomaly check, once `work_locations` and `attendance_logs.scanner_location` are used together that way.

**New `attendance_types` rows**: "Overseas Trip", "Local Trip" — self-selectable, mirroring the existing Site Visit/WFH/Business Meeting/Training rows (`attendance_types` has no `category` column and no seed migration — rows are created directly in Supabase Studio — so this is just two inserted rows, no schema change). **Must not recreate the exact conflict that got "Overtime" removed as a self-selectable type** (see "Problem" above): a trip type is a *context* flag consumed by the claims/allowance layer below, and must never feed back into or override the neutral, calculated attendance figures on `unified_daily_attendance` (Part A's rate-tier estimate, `overtime_hours`, etc.) — those stay purely observational regardless of trip context.

**Proposed schema** — a sibling table to `overtime_claims`, not a repurposing of it (the allowance is a monetary daily entitlement, not a claimed hour count, and the approval/reconciliation shape differs):

```sql
create table public.trip_allowance_claims (
    id             uuid primary key default gen_random_uuid(),
    employee_id    uuid not null references public.employees(id),
    trip_type      text not null check (trip_type in ('overseas', 'local')),
    trip_start_date date not null,
    trip_end_date  date not null,
    destination    text,
    status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    submitted_by   uuid not null references public.employees(id),
    submitted_at   timestamptz not null default now(),
    reviewed_by    uuid references public.employees(id),
    reviewed_at    timestamptz,
    review_notes   text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- One row per day of the trip -- the allowance/RPL rule is evaluated per
-- day (is that day a weekend?), not once for the whole trip.
create table public.trip_allowance_claim_days (
    id                  uuid primary key default gen_random_uuid(),
    trip_claim_id       uuid not null references public.trip_allowance_claims(id) on delete cascade,
    claim_date          date not null,
    is_weekend          boolean not null, -- snapshotted at approval time, not re-derived later
    allowance_multiplier numeric,   -- 1 (normal day), 2 (overseas weekend); null when RPL applies instead
    rpl_granted         boolean not null default false, -- true only for a local-trip weekend day
    unique (trip_claim_id, claim_date)
);
```

**The RPL/HR2000-sync conflict, flagged explicitly (not yet resolved)**: `rpl_granted = true` needs to actually grant a Replacement Leave day, which means writing into `leave_ledger_entries` (`leave_ledger_types.code = 'RPL'`) — but that table is today a pure, full-snapshot diff-sync mirror of HR2000's weekly CSV export (`sync_leave_ledger_from_snapshot`, `hyrax-data-platform/infrastructure/leave_ledger_migration.sql`). **Anything this app writes there that HR2000 doesn't independently also know about will be silently wiped on the next weekly sync.** Recommended (not yet decided, needs confirmation before building): add a `source text check (source in ('hr2000_sync', 'app_granted'))` column to `leave_ledger_entries`, mirroring the same pattern already planned for `payroll_reconciliation_email_sends`'s own deferred `source` column (see the "Planned: automated email" appendix in `PAYROLL-DATA-REQUIREMENTS.md`), so the sync only ever touches/overwrites rows it owns and leaves app-granted RPL rows alone. Even with that fix, HR would still need a parallel manual step to also record the same grant in HR2000 itself, unless/until this app becomes the true system of record for RPL — worth confirming with HR whether that dual-entry is acceptable or a blocker.

**Overlap to clarify with HR/Finance before building** (not resolved here): the business-trip Expense Claims module (`docs/EXPENSE-CLAIMS-DESIGN.md`) also lists "Subsistence Allowance" as one of its business-trip expense categories. It's not yet clear whether that's the *same* daily allowance described here (in which case `trip_allowance_claims` should be the single source of truth, and Expense Claims should reference it rather than duplicate it) or a genuinely separate, receipt-based reimbursement on top of this fixed entitlement. Confirm which before building either.

## Open questions (need the real paper form to answer)

- Exact fields the paper form captures — does it record hours directly, or clock times HR converts to hours? Is there a project/cost-center code? A reason/category beyond overtime vs. weekend vs. holiday?
- Who fills it in practice: the employee themselves, their manager, or HR transcribing after the fact? This decides whether `submitted_by` is usually the employee or HR, and whether a manager-approval tier sits before HR ever sees it, or HR is the only approver.
- Retention/audit expectations for the attached scan (how long, who can view it, does Finance/payroll need direct access to the Drive files too).
- Whether a claim can span multiple dates in one submission (e.g. "overtime for the whole week") or must be one row per date, matching this draft schema's assumption.
- What tolerance (if any) is acceptable between claimed and calculated hours before `is_ot_claim_mismatch` fires — exact match, or some rounding allowance.

## Files this will create, when built

- `supabase/sql_editor/overtime_claims_schema_migration.sql` — the two `overtime_claims`/`overtime_claim_attachments` tables above
- `supabase/policies/overtime_claims_crud.sql`, `supabase/policies/overtime_claim_attachments_crud.sql` — RLS (self-submit/view own, manager/HR approve, mirroring `attendance_activities_crud.sql`'s existing tiers)
- `supabase/functions/approve_overtime_claim.sql`, `supabase/functions/reject_overtime_claim.sql` — mirroring `approve_attendance`/`reject_attendance`
- `src/features/hr/overtimeClaims/` (or similar) — the usual `private/api` + `private/hooks` feature-module shape this codebase already follows
- A new page (location TBD — see "Submission UI" above) + `src/components/dataTable/editors/OvertimeClaimAttachmentsEditor.jsx` (or similarly named, mirroring `TaskDocumentsEditor.jsx`)
- A new `getOvertimeClaimMismatchFlags`-style function alongside `payrollExport/filterConfig.js`'s existing `getRowReconciliationFlags`, plus whatever RPC change is needed to surface claimed-vs-calculated hours per employee per period
- Two new `attendance_types` rows ("Overseas Trip", "Local Trip") — a plain INSERT, no migration file needed (this table has no seed file precedent)
- `supabase/sql_editor/trip_allowance_claims_schema_migration.sql` — the `trip_allowance_claims`/`trip_allowance_claim_days` tables above
- `supabase/sql_editor/leave_ledger_entries_add_source_column.sql` (or similar) — the recommended `source` column resolving the RPL/HR2000-sync conflict, **only if that recommendation is confirmed**
- `supabase/policies/trip_allowance_claims_crud.sql` and matching approve/reject RPCs, mirroring the `overtime_claims` pattern above
- This doc, `docs/PAYROLL-DATA-REQUIREMENTS.md`, `docs/EXPENSE-CLAIMS-DESIGN.md` (once the allowance/subsistence overlap above is resolved), and `CLAUDE.md` (if a new feature-module convention is introduced), updated once shipped

## Verification, once built

Submit a claim as a test employee with a Drive-attached scan, approve it as HR, confirm it appears correctly reconciled (no mismatch flag) in Payroll Export for the matching period; then submit a claim that deliberately disagrees with the calculated hours and confirm the new mismatch flag appears on that row via the existing `RowFlagBadge` hover tooltip.

For the business-trip allowance/RPL addition: submit a trip claim spanning a weekend as an overseas trip, approve it, confirm the weekend day's `allowance_multiplier = 2` and no RPL is granted; submit an equivalent local-trip claim, approve it, confirm `rpl_granted = true` and a new `leave_ledger_entries` row actually appears (tagged `source = 'app_granted'` if that fix is built) without being removed by the next `sync_leave_ledger_from_snapshot` run.
