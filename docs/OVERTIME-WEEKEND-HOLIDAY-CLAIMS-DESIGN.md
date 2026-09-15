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

## Open questions (need the real paper form to answer)

- Exact fields the paper form captures — does it record hours directly, or clock times HR converts to hours? Is there a project/cost-center code? A reason/category beyond overtime vs. weekend vs. holiday?
- Who fills it in practice: the employee themselves, their manager, or HR transcribing after the fact? This decides whether `submitted_by` is usually the employee or HR, and whether a manager-approval tier sits before HR ever sees it, or HR is the only approver.
- Retention/audit expectations for the attached scan (how long, who can view it, does Finance/payroll need direct access to the Drive files too).
- Whether a claim can span multiple dates in one submission (e.g. "overtime for the whole week") or must be one row per date, matching this draft schema's assumption.
- What tolerance (if any) is acceptable between claimed and calculated hours before `is_ot_claim_mismatch` fires — exact match, or some rounding allowance.

## Files this will create, when built

- `supabase/sql_editor/overtime_claims_schema_migration.sql` — the two tables above
- `supabase/policies/overtime_claims_crud.sql`, `supabase/policies/overtime_claim_attachments_crud.sql` — RLS (self-submit/view own, manager/HR approve, mirroring `attendance_activities_crud.sql`'s existing tiers)
- `supabase/functions/approve_overtime_claim.sql`, `supabase/functions/reject_overtime_claim.sql` — mirroring `approve_attendance`/`reject_attendance`
- `src/features/hr/overtimeClaims/` (or similar) — the usual `private/api` + `private/hooks` feature-module shape this codebase already follows
- A new page (location TBD — see "Submission UI" above) + `src/components/dataTable/editors/OvertimeClaimAttachmentsEditor.jsx` (or similarly named, mirroring `TaskDocumentsEditor.jsx`)
- A new `getOvertimeClaimMismatchFlags`-style function alongside `payrollExport/filterConfig.js`'s existing `getRowReconciliationFlags`, plus whatever RPC change is needed to surface claimed-vs-calculated hours per employee per period
- This doc, `docs/PAYROLL-DATA-REQUIREMENTS.md`, and `CLAUDE.md` (if a new feature-module convention is introduced), updated once shipped

## Verification, once built

Submit a claim as a test employee with a Drive-attached scan, approve it as HR, confirm it appears correctly reconciled (no mismatch flag) in Payroll Export for the matching period; then submit a claim that deliberately disagrees with the calculated hours and confirm the new mismatch flag appears on that row via the existing `RowFlagBadge` hover tooltip.
