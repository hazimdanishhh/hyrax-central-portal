# Work Locations & Structured Addresses — Architecture Plan

**Status: designed, not yet built.** `employees.address_work`/`address_personal` still exist as plain free-text columns today. This document is the reference for whoever implements this once the underlying decision to build it is acted on — it is not describing shipped behavior.

## Why

`employees.address_work` and `employees.address_personal` are both plain `text` columns with zero validation, entered as free-form strings on the Employee Management edit form. Two unrelated needs are pushing on this field:

1. **Early-leave calculation needs a real site concept.** Early leave (see `hr_unified_daily_attendance_view.sql`'s `is_early_leave` column) is company-wide a flat 5:00 PM cutoff today. The two physical sites — KL (office) and Meru (blending plant) — need different cutoffs (KL 5:00 PM, Meru 5:30 PM), which means "what site is this employee assigned to" has to become a real, queryable fact, not a free-text string like `"KL office, Jalan Example"`.
2. **Personal address should be structured**, not a single text blob, so it can eventually support things a plain string can't (validated postcode, city-level reporting, mail-merge, etc.), and so the Employee Management form gains a real "create an address record for this person" flow instead of a bare text box.

These are two different problems with two different table shapes — a work location is a small shared lookup (a handful of rows, many employees point at the same one), a personal address is a unique structured record per employee (one row per person, nothing to "pick from a list"). They should **not** be merged into one generic "addresses" table with a type flag; the schema and the UI pattern for each are fundamentally different (see below).

## Decisions already made (do not re-litigate these)

- **Overtime stays a flat 6:00 PM company-wide threshold forever** — it does not become location-dependent even after this ships. Only early leave varies by location.
- **Early-leave threshold always uses the employee's assigned work location**, never the day's actual scanner location. An employee normally based in KL who visits Meru for a day still gets KL's 5:00 PM cutoff that day. This is also the only option that works for remote/app-based attendance, which has no scanner location at all.
- `address_work` is **fully replaced** by `work_location_id` — not kept alongside as a separate free-text field.
- `employees_public_view.sql`'s `manager_address_work` column (confirmed dead — zero frontend consumers) gets dropped in the same pass, not carried forward into the new join.

## Schema

### `work_locations` — small shared lookup, mirrors `departments`' exact shape

`departments` is the only existing lookup table in this schema with a short-code column (`sub`), so `work_locations` mirrors it exactly rather than inventing a new shape:

```sql
create table public.work_locations (
    id bigint generated always as identity primary key,
    sub text not null default '' unique,      -- "KL", "MERU"
    name text not null,                        -- "Kuala Lumpur (Office)", "Meru (Blending Plant)"
    early_leave_time time not null default '17:00:00',
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);
```

No `is_active` column — no lookup table in this schema has one (`departments`, `nationalities`, `employment_status`, `employment_type`, `identification_type` all lack it); don't introduce a new convention here without a reason to. Seed via a CSV in `supabase/csv/` (matching `departments_rows.csv`'s own convention), not a CRUD admin page — `departments` itself has no CRUD page either (`Departments.jsx` is a stub today), so a 2-row lookup doesn't need one.

No overtime column on this table — overtime is a flat constant per the decision above, not per-location.

### `addresses` — structured personal address, one row per employee

Unlike `work_locations`, this is normalization into components, not a shared-values lookup — every employee gets their own row:

```sql
create table public.addresses (
    id bigint generated always as identity primary key,
    line1 text,
    line2 text,
    city text,
    state text,
    postcode text,
    country text,
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);
```

`employees.personal_address_id bigint references addresses(id)` — nullable, not DB-enforced 1:1 (matches this schema's general preference for minimal constraints; nothing today needs a hard uniqueness guarantee here).

### `employees` table changes

- Add `work_location_id bigint references work_locations(id)` and `personal_address_id bigint references addresses(id)` — additive, nullable, no data loss risk on their own.
- Drop `address_work`/`address_personal` text columns only once the manual migration below is judged complete — not on a fixed timer.

## Frontend refactor — every touchpoint, confirmed exhaustive by direct grep (not assumption)

### Work location (`address_work` → `work_location_id`)

This is a genuine "select from a small set of existing options" field — the app's existing `select`/`asyncSelect` editors already cover this, no new editor component needed.

- **`src/pages/user/hr/employeeManagement/list/tableConfig.jsx`** (currently lines ~444-451) — the sole write path today (a bare `editor: "text"` column). Swap for `work_location_id`, `editor: "select"`, options sourced from a new `workLocations` metadata fetch.
- Wherever `useEmployeesMetadata()` currently sources `departments` — add a parallel `workLocations` fetch, identical shape.
- **`src/data/profileData.js`** (line ~122, "Address (Work)" field) — becomes a display of the joined `work_location.name`.
- **`src/pages/user/employees/employeeProfile/EmployeeProfile.jsx`** (lines ~181-185) — same swap for its direct render.
- **`supabase/sql_editor/employees_public_view.sql`** — replace `e.address_work` (line 14) with a join to `work_locations` (`wl.name as work_location_name`, `wl.sub as work_location_code`); drop `m.address_work as manager_address_work` (line 28) entirely rather than migrating it — confirmed dead.
- **`supabase/sql_editor/hr_unified_daily_attendance_view.sql`** — add `left join work_locations wl on wl.id = u.work_location_id` (via the existing `expected_shifts`/`employees` join), expose `work_location_id`/`work_location_name`, and change `is_early_leave`'s threshold from the flat `TIME '17:00:00'` literal to `coalesce(wl.early_leave_time, TIME '17:00:00')`. This column was deliberately written as a `COALESCE` expression from day one specifically so this is the only line that needs to change — see that file's own comment on `is_early_leave`.
- **`get_attendance_dashboard_rpc.sql`** and **`get_hr_reports_dashboard_rpc.sql`** — add a `p_work_location_id` parameter, mirroring `p_department_id`'s exact null-passthrough pattern in every CTE. **Both files carry their own OVERLOAD WARNING comment already** — adding a parameter creates a second overloaded function instead of replacing the existing one; run `DROP FUNCTION ... (old signature)` in Supabase Studio before redeploying either.
- List/Overview/Reports `filterConfig.js` files (Attendance List — HR's plus the duplicated My/Team Attendance List copies, Attendance Overview, HR Reports) — add a "Work Location" dropdown, mirroring the existing department dropdown exactly.
- `attendanceOverviewService.js`'s `applyAttendanceFilter` — add `case "workLocation": return query.eq("work_location_id", value);`.

### Personal address (`address_personal` → structured, created inline)

This codebase already has a proven pattern for "create a linked record without leaving the parent form": `src/components/dataTable/editors/LeadAccountEditor.jsx` (Sales Leads' account picker — search existing, or a `__create` pseudo-option that swaps in an inline sub-form) plus `leadsMutationsService.js`'s `splitAccountField()` (splits one synthetic form field into real columns right before `normalizeFields`). Personal address is simpler than that case: there's no "search for an existing one" step at all — every employee always creates-or-updates their own single linked row.

**Recommended shape: no new custom editor component.** Add 5 flat `editor: "text"` columns to `tableConfig.jsx` — `personal_address_line1`, `personal_address_line2`, `personal_address_city`, `personal_address_state`, `personal_address_postcode`, `personal_address_country` — all under the existing `section: "Address Information"`. `DataForm.jsx` already groups same-section columns together with zero additional code (confirmed by reading it in full — it has no native "multi-sub-field composite column" concept, but doesn't need one here). Add a `splitPersonalAddressFields()` helper in `employeeMutations.js`, mirroring `splitAccountField()`'s exact call-site pattern: on save, upsert the linked `addresses` row (`UPDATE` if `personal_address_id` is already set, else `INSERT` then link) before `normalizeFields` runs, and write the resulting id onto the `employees` payload as `personal_address_id`.

- **`src/data/profileData.js`** (line ~123, "Address (Home)") — becomes a formatted read of the joined `addresses` row.
- **`src/pages/user/employees/employeeProfile/EmployeeProfile.jsx`** — currently doesn't render `address_personal` at all (confirmed: it was never in `employees_public_view.sql`, unlike `address_work`). Fixing this means *adding* the `addresses` join to that view for the first time, not swapping an existing projection.

## Migration / backfill strategy — deliberately manual, not auto-parsed

Both source fields are unstructured free text with zero format enforcement — confirmed plain `text` columns, no CHECK constraints, no consistent pattern in the actual data. Auto-parsing either into the new structured shape risks **silent** data corruption: a wrong work-location match would quietly skew every early-leave figure for that employee without ever surfacing as an obvious error. This codebase already applies the same caution elsewhere (e.g. the leave-type `needs_hr_confirmation` flags on unconfirmed HR2000 leave-type labels) — flag ambiguous data to a human, don't guess.

- **`work_location_id`**: HR reviews and manually assigns each employee's location via the new form (or a one-time, human-reviewed SQL `UPDATE`). Do not attempt a `CASE WHEN address_work ILIKE '%KL%'` auto-match.
- **`personal_address_id`**: when an employee is first edited post-migration, pre-fill the new `personal_address_line1` field with their existing raw `address_personal` string as a starting point, rather than attempting to auto-split free text into city/state/postcode. Let HR re-enter it once into the structured fields.
- Drop `address_work`/`address_personal` only once this manual pass is judged complete.

## Edge cases to resolve at implementation time (flagged here, not decided — genuine judgment calls)

- **Remote/WFH employees with no fixed site**: `work_location_id IS NULL` falls back to the flat 17:00 default via `COALESCE` in the view — functionally fine, but should remote employees instead get their own real "Remote" `work_locations` row, so the new location *filter* has something meaningful to show for them instead of "Unassigned"? Worth deciding once real remote-employee volume is known.
- **Location transfers are not historized.** `work_location_id` lives on `employees` (current state only) — an employee who transfers from KL to Meru will have their *entire* historical attendance record reclassified under the new location. This is the same already-accepted limitation `department_id` has today (department transfers behave identically) — not a new problem introduced by this change, just worth naming so it isn't mistaken for a regression later.
- **Scanner-location cross-check is a deliberately separate, unscoped idea.** Once both `work_locations` and `attendance_logs.scanner_location` exist side by side, an "employee scanned somewhere other than their assigned location today" anomaly check becomes possible. Explicitly not part of this plan (assigned location always governs the early-leave threshold, confirmed above) — a natural future extension, not something to build now.

## See also

The immediate overtime/early-leave calculation fix that this design was built to slot into cleanly (the `overtime_hours`/`is_early_leave` columns on `unified_daily_attendance`, already shipped) needed no schema change and is already live — see that view's own inline comments for the exact `COALESCE` seam this document's `work_locations` join is meant to fill in.
