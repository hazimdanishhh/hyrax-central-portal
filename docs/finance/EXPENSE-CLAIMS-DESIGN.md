# Expense Claims (Business Trip + Normal) — Design (not built yet)

**Status: designed, not implemented.** Nothing in this doc exists in the database or codebase yet — no table, migration, RPC, or UI. `src/pages/user/employee/claims/Claims.jsx` and `src/pages/user/finance/claimsManagement/ClaimsManagement.jsx` are today's entire footprint: empty placeholder stubs (`function Claims() { return <div>Claims</div>; }`), already routed and (for the Finance side) already `AccessRoute`-gated to `departments={["FIN"]}`, with a commented-out nav entry ready to enable and a live "Create Expense Claim" quick-action already pointing at the employee stub.

## Why this is a separate module from Overtime/Weekend/Holiday Claims

Confirmed, not assumed — this is genuinely a different domain, not a naming coincidence:

| | Overtime/Weekend/Holiday Claims (`docs/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md`) | Expense Claims (this doc) |
|---|---|---|
| Owner | HR / direct manager | Finance |
| Data shape | Hours, dates | Money, expense categories, receipts |
| Downstream consumer | Payroll hours export (Payroll Export tab) | Reimbursement / accounts payable |
| Approval chain | Manager or HR (mirrors `approve_attendance`) | Finance (mirrors `ClaimsManagement.jsx`'s own `AccessRoute`) |

The existing stubs' own nav copy already confirms this framing — `src/data/departmentLinkCardData.js`'s commented-out Claims Management entry describes it as "Process and track expense and reimbursement claims," and a live quick-action already labeled "Create Expense Claim" links to the employee-facing stub. Don't merge this with the HR-owned claims doc; keep the two approval chains and data models separate, per standard T&E (travel & expense) practice of separating time/attendance claims from expense reimbursement claims.

## Categories (as given, not guessed)

Two claim types, sharing several categories:

- **Business trip claims**: Accommodation, Meals, Transportation, Subsistence Allowance, Others, Advances.
- **Normal claims**: Petrol, Toll, Parking, Mileage, Car Maintenance, Entertainment, Medical, Complimentary, Subsistence Allowance, Accommodation, Others.

Accommodation, Subsistence Allowance, and Others appear in both lists — this is why the schema below uses one shared `expense_claim_categories` lookup table with a claim-type applicability array, rather than two independent, hardcoded category sets.

**Open question, not resolved here**: `docs/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md`'s new business-trip section separately proposes a fixed daily allowance (`trip_allowance_claims`) tied to trip attendance (1x normal day, 2x overseas weekend, or RPL on a local weekend). It is **not yet clear** whether "Subsistence Allowance" here is that same entitlement (in which case this module should reference `trip_allowance_claims` rather than duplicate it) or a genuinely separate, receipt-based reimbursement claimed on top of it. Confirm with HR/Finance before building either.

## Proposed schema (draft)

Mirrors this codebase's only existing header+lines-with-approval precedent — the dormant, never-wired-up `sales_quotations`/`sales_quotation_items` (`hyrax-data-platform/infrastructure/supabase_schema.sql`) — and reuses the Drive-attachment shape already established by `documents`/`overtime_claim_attachments`:

```sql
create table public.expense_claim_categories (
    id                   bigint generated always as identity primary key,
    code                 text not null unique,   -- 'ACCOMMODATION', 'MEALS', 'TRANSPORTATION',
                                                    -- 'SUBSISTENCE_ALLOWANCE', 'ADVANCE', 'PETROL',
                                                    -- 'TOLL', 'PARKING', 'MILEAGE', 'CAR_MAINTENANCE',
                                                    -- 'ENTERTAINMENT', 'MEDICAL', 'COMPLIMENTARY', 'OTHERS'
    label                text not null,
    -- Which claim_type(s) this category is valid for -- e.g. Subsistence
    -- Allowance/Accommodation/Others apply to both; Mileage/Petrol are
    -- normal-claim only; Advances is business-trip only.
    applicable_claim_types text[] not null,
    requires_mileage     boolean not null default false, -- true only for MILEAGE
    is_active            boolean not null default true
);

-- One row per claim header -- an employee's single business-trip or
-- normal-claim submission.
create table public.expense_claims (
    id              uuid primary key default gen_random_uuid(),
    employee_id     uuid not null references public.employees(id),
    claim_type      text not null check (claim_type in ('business_trip', 'normal')),
    title           text,          -- e.g. "Client visit - Singapore, Sept 2026"
    trip_start_date date,          -- business_trip only
    trip_end_date   date,
    destination     text,          -- business_trip only
    status          text not null default 'draft'
                    check (status in ('draft', 'submitted', 'approved', 'rejected', 'paid')),
    total_amount    numeric not null default 0, -- denormalized sum of expense_claim_lines
    submitted_by    uuid references public.employees(id),
    submitted_at    timestamptz,
    reviewed_by     uuid references public.employees(id),
    reviewed_at     timestamptz,
    review_notes    text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz default now()
);

-- One row per expense line item under a claim.
create table public.expense_claim_lines (
    id            uuid primary key default gen_random_uuid(),
    claim_id      uuid not null references public.expense_claims(id) on delete cascade,
    category_id   bigint not null references public.expense_claim_categories(id),
    description   text,
    amount        numeric not null check (amount >= 0),
    expense_date  date,
    mileage_km    numeric, -- only meaningful when category_id is MILEAGE
    created_at    timestamptz not null default now()
);

-- Google Drive receipt attachments -- mirrors documents_schema_migration.sql/
-- overtime_claim_attachments' Drive-reference-only shape. Attached to a
-- specific line (a receipt for one expense) or to the whole claim (e.g. the
-- trip itinerary) -- claim_line_id is nullable for the latter case.
create table public.expense_claim_attachments (
    id            uuid primary key default gen_random_uuid(),
    claim_id      uuid not null references public.expense_claims(id) on delete cascade,
    claim_line_id uuid references public.expense_claim_lines(id) on delete cascade,
    drive_file_id text not null,
    name          text not null,
    url           text not null,
    mime_type     text,
    icon_url      text,
    attached_by   uuid not null references public.employees(id),
    attached_at   timestamptz not null default now()
);
```

## Submission UI

- A new page under `src/pages/user/employee/claims/` (replacing the current stub) rendering a `DataForm`-style header (claim type, title, trip dates/destination if applicable) plus a dynamic, addable/removable list of expense lines — this codebase has no existing precedent for a live "add/remove line item" create form (every Finance list module today is a read-only SAP mirror; the closest schema precedent, `sales_quotations`/`sales_quotation_items`, was never wired to any UI either), so this is genuinely new UI work, not a reuse of an existing pattern.
- Receipt attachment per line (or per claim) reusing `GoogleDrivePicker` exactly as `TaskDocumentsEditor.jsx`/`OvertimeClaimAttachmentsEditor.jsx` (see the sibling claims doc) already do.
- `src/pages/user/finance/claimsManagement/` (replacing the `ClaimsManagement.jsx` stub) as the Finance-side review queue — list + drilldown + approve/reject, following the same `tableConfig.jsx`/`DataSidebar` pattern used throughout this codebase.

## Approval flow

Mirror `approve_attendance`/`reject_attendance`'s exact authorization pattern (`SECURITY DEFINER`, single `Pending → Approved`/`Rejected` transition guarded by a `WHERE status = 'submitted'` no-op-on-already-decided clause), scoped to the Finance department instead of HR/manager — matching `ClaimsManagement.jsx`'s existing `AccessRoute departments={["FIN"]}` gate. `status = 'paid'` is a separate, later transition (Finance marking a claim as actually disbursed), not part of the approve/reject pair itself.

## Explicitly flagged open questions (not resolved in this pass)

- **Two-stage approval?** Real T&E workflows commonly need a manager's pre-trip sign-off (especially for a cash advance) separate from Finance's post-trip reimbursement decision. "Advances" being one of the business-trip categories suggests this may be needed, but this draft schema assumes a single Finance-only approval stage. Recommend scoping the first real build to the simpler single-stage flow, with a pre-trip advance-request workflow as an explicit, separate later extension — not building both at once.
- **Reimbursement destination**: no employee bank/payment data exists anywhere in this system today (confirmed — same gap already tracked in `docs/PAYROLL-DATA-REQUIREMENTS.md` §1). `status = 'paid'` can exist as a marker, but this app cannot itself tell Finance *where* to send money.
- **Currency**: the app is MYR-only in every current UI (no Finance list — Bills, Invoices, Payments, Chart of Accounts — displays currency at all today, despite their underlying SAP-mirror tables already carrying a full document-currency/system-currency/exchange-rate shape). An overseas-trip receipt in a foreign currency may need that same triad reused here; not scoped in this draft.
- **GL posting**: `sap_gl_accounts` already has a live "Expenses" drawer (`drawer = 6`) in the chart of accounts, but nothing in this app currently lets a user-created record post against a real GL account code, and there's no cost-center concept anywhere in the schema (`departments` is a flat lookup, no GL/cost-center mapping — same confirmed gap as payroll's own department→GL mapping). If Finance needs claims to post to a specific account, that mapping needs to be designed separately.
- **The Subsistence Allowance overlap with `trip_allowance_claims`** — see "Categories" above.

## Files this will create, when built

- `supabase/sql_editor/expense_claims_schema_migration.sql` — the four tables above
- `supabase/policies/expense_claims_crud.sql`, `expense_claim_lines_crud.sql`, `expense_claim_attachments_crud.sql` — RLS (self-submit/view own, Finance approve, mirroring `attendance_activities_crud.sql`'s tiers)
- `supabase/functions/approve_expense_claim.sql`, `supabase/functions/reject_expense_claim.sql` — mirroring `approve_attendance`/`reject_attendance`
- `src/features/finance/expenseClaims/` (or similar) — the usual `private/api` + `private/hooks` feature-module shape this codebase already follows
- Real pages replacing both `Claims.jsx` and `ClaimsManagement.jsx` stubs, plus enabling the already-commented-out nav entries (`sideNavLinkData.js`, `departmentLinkCardData.js`)
- This doc, `docs/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md` (once the Subsistence Allowance overlap is resolved), and `CLAUDE.md` (new feature-module convention), updated once shipped

## Verification, once built

Submit a normal claim (e.g. Petrol + Toll, two line items, one receipt each) as a test employee, confirm it appears in Finance's `ClaimsManagement` queue, approve it, confirm `status` transitions correctly and `total_amount` matches the sum of its lines. Submit a business-trip claim with a destination/date range and an Advances line, confirm the same flow, and confirm rejecting a claim requires a reason (mirroring `reject_attendance`'s mandatory `rejection_reason`).
