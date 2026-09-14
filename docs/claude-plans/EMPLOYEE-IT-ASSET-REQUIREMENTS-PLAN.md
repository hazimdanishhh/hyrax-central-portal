# Employee IT Asset Requirements — a real request model instead of a lone flag

> Saved plan, not yet executed. Continue this later by picking up from "Part 1" below.

## Context

`employees.needs_it_asset` is a tri-state flag (`true`/`false`/`null`) that gates 3 onboarding checklist items (`device_access_card_ready`, `it_asset_assigned`, `device_handed_over`) and 1 offboarding item (`it_assets_returned`). Its RHF validation bug (selecting "Not Needed" or "Not Decided" incorrectly failed "required") was already fixed in `DataForm.jsx` in the prior pass. This plan addresses the deeper design gap underneath that bug report: the flag carries no information about *what kind* of asset a new hire needs (laptop/desktop/phone/access card/combination), and today it is **completely disconnected** from the real, already-rich IT asset taxonomy — confirmed by direct research:

- `it_asset_category`/`it_asset_subcategory` already model exactly this granularity as a real 2-level hierarchy, live on the `it_assets` table today (e.g. "Access Card" is already a seeded subcategory under "Security").
- The only bridge between `needs_it_asset` and the real `it_assets` table is a **best-effort existence-check trigger** (`sync_lifecycle_item_on_it_asset_assignment.sql`): the moment *any* `it_assets` row gets `asset_user_id` set to this employee, the checklist item flips to DONE — regardless of whether the assigned asset is the right type, or covers everything the hire actually needs. There is no record anywhere of *which* asset satisfied *which* need.
- The one outbound signal to IT (`employee.it_asset_requested` notification) links to the generic `/app/it/assets/list` page with no payload about what to actually provision.
- `needs_it_asset` is also the *only* ad hoc boolean/tri-state flag ever added to `employees` — everything else added since the original schema is either an FK to a proper lookup table (`work_location_id`, `personal_address_id`) or a narrowly-scoped notification-dedup timestamp. This codebase has a strong existing precedent for "enrich a lookup table / add a real relationship" over "add another flag" (see `employment_status_category_migration.sql`, which replaced 4 separately-drifting hardcoded "is this employee active" definitions with one real `employment_status.category` column) — `needs_it_asset` is the outlier, not the norm, and this plan brings it in line with that precedent rather than repeating the mistake.

**Decisions already made** (confirmed with the user):
- Keep `needs_it_asset` exactly as-is (the coarse yes/no/not-decided gate the onboarding seed SQL already reads) — do not remove the null option or force a default. No bulk backfill of existing null rows from before the lifecycle module existed; they stay null until someone actually decides.
- Add a new table that captures the actual asset request(s), referencing the existing `it_asset_category`/`it_asset_subcategory` taxonomy — additive, not a rewrite of the onboarding case-seeding SQL.
- Address/geography reference tables (dropdown-backed `state`/`country`) are explicitly **out of scope for this plan** — a separate future conversation. For the record, once that happens: seed small `countries` + `states`/`provinces` tables from a standard, static open dataset (ISO 3166-1/3166-2 — e.g. the well-known open-source `countries-states-cities-database` project), explicitly skipping its city-level data — `city` should stay free text, since cities don't fit this codebase's own "small shared lookup" convention for reference tables the way countries/states do.

## Part 1 — New table: `employee_it_asset_requests` (do this first)

New file, `hyrax-central-portal/supabase/sql_editor/employee_it_asset_requests_migration.sql`, mirroring the existing lookup/relationship conventions in this schema (`it_assets`' own shape, `departments`' `{id, name, sub}` simplicity):

```sql
create table public.employee_it_asset_requests (
    id bigint generated always as identity primary key,
    employee_id uuid not null references public.employees(id),
    asset_category_id bigint references public.it_asset_category(id),
    asset_subcategory_id bigint not null references public.it_asset_subcategory(id),
    quantity integer not null default 1,
    status text not null default 'requested' check (status in ('requested', 'fulfilled', 'cancelled')),
    fulfilled_by_asset_id uuid references public.it_assets(id),
    notes text,
    requested_at timestamptz not null default now(),
    fulfilled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);
```
(`asset_category_id` is stored alongside `asset_subcategory_id` even though the subcategory itself FKs to a category — deliberately mirroring `it_assets`' own redundant-but-query-convenient shape, not a new pattern.)

Corresponding RLS policies mirroring `addresses_crud.sql`'s pattern (HR + IT department CRUD, self read-only or no self-access — this is HR/IT operational data, not employee-editable).

**UI home**: `src/pages/user/employeeLifecycle/detail/LifecycleCaseDetail.jsx` — not Employee Management's generic `DataForm`/`tableConfig.jsx` (that pattern is single-row, not suited to a repeating request list). Add a small "IT Asset Requests" card there, shown when the case's checklist includes the IT-gated items (i.e. `needs_it_asset = true`), letting HR add rows (subcategory + quantity) and IT mark them fulfilled/cancelled. This is exactly where HR and IT already interact with this specific hire's checklist — closing the gap the research confirmed (`LifecycleCaseDetail.jsx` today has zero mentions of "asset" anywhere).

No change needed to `get_or_create_onboarding_case.sql`'s seeding logic — it keeps gating the 3 checklist items on `needs_it_asset = true` exactly as today.

## Part 2 — Wire the derived checklist item to real requests (natural follow-on, not required for Part 1 to be useful)

Currently `it_asset_assigned` flips to DONE the moment *any* `it_assets` row is assigned to the employee. Once Part 1 exists, `sync_lifecycle_item_on_it_asset_assignment.sql` can do better:
- When an `it_assets` row's `asset_user_id` is newly set, look for a `requested`-status `employee_it_asset_requests` row for that employee matching the asset's subcategory (oldest first), and mark it `fulfilled` with `fulfilled_by_asset_id`/`fulfilled_at` set.
- Only flip the checklist item to DONE once every request row for that employee is `fulfilled` (or there were none to begin with, preserving today's fallback behavior when no requests were ever logged).

This turns the checklist item from "an asset exists, any asset" into "every specific thing IT was asked to provide has actually been provided" — directly closing the gap between the two systems.

## Part 3 — New convention doc (do this now too, low-risk, high value)

New file, `hyrax-central-portal/docs/EMPLOYEE-DATA-MODELING-CONVENTIONS.md` — there is currently no ADR or written convention anywhere in either repo for "when does something become a column on `employees` vs. an FK to a lookup table vs. a whole new child table," confirmed by research (only organically-accumulated, unwritten precedent in migration-file comments). Write down the heuristic this audit surfaced, using real examples already in this codebase:
- **Narrow, single-purpose, system-written value** (a notification-dedup timestamp) → a plain column on `employees` is fine.
- **Closed, shared, slowly-changing set that many employees point at the same row of** (department, nationality, work location) → FK to a small `{id, name, [sub]}` lookup table, mirroring `departments`.
- **Something that can legitimately be zero-or-more per employee, or needs its own status/lifecycle** (IT asset requests here; future software/license grants, explicitly already flagged as a deferred gap in `EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md`) → its own child table, not a flag or a comma-joined text field.
- Worked examples to cite directly: `employment_status_category_migration.sql` (the right way — enriching a lookup table once instead of 4 drifting hardcoded definitions across files) and `needs_it_asset` pre-this-plan (the wrong way — a flag that should have been a relationship from day one).
- Flag `it_assets.asset_location_id`/`vendor_id` as known, related debt worth citing in the doc (FK-shaped columns with no backing table or constraint at all, currently rendered as plain free-text inputs) — **not fixed in this pass**, just recorded so it doesn't get copied as a pattern again.

## Explicitly deferred / out of scope for this plan

- Address/geography reference tables (`addresses.state`/`country` as dropdowns) — separate future plan. When it happens: small `countries` + `states` tables seeded once from a standard ISO 3166-1/3166-2 dataset, `city` stays free text.
- No bulk backfill of existing null `needs_it_asset` rows.
- `it_assets.asset_location_id`/`vendor_id`'s missing backing tables — noted in the new convention doc, not fixed here.
- Software/license inventory — already a named, deferred gap in the lifecycle architecture doc; this plan doesn't pull it forward.

## Verification (once implemented)

- After the migration runs: confirm `employee_it_asset_requests` rows can be created/edited/fulfilled from `LifecycleCaseDetail.jsx` for a real onboarding case, and that RLS lets HR create requests and IT mark them fulfilled (and blocks the employee themselves, consistent with other HR/IT-only tables).
- If Part 2 is implemented: assign a real `it_assets` row to an employee with 2+ open requests and confirm the checklist item only flips to DONE once every request is fulfilled, not on the first assignment.
- Confirm `needs_it_asset`'s existing behavior (the 3 checklist items still seed PENDING/SKIPPED based on true vs. false/null) is completely unchanged by this pass.
