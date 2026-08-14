# Onboarding Workflow Architecture

**Status:** Design only (2026-08) — nothing in this doc has been implemented. This is the detailed design to build from in a later pass, tracked as `Proposed` rows in [`docs/NOTIFICATION-RULES-TRACKER.csv`](./NOTIFICATION-RULES-TRACKER.csv).

Two related gaps, both about getting a new hire from "exists in Google Workspace" to "fully set up in this portal" without anyone having to remember to check:

1. **Nobody is told when a new person shows up.** A brand-new profile is created silently, with no role, no department, and no link to their `employees` record — today the only way to find one is a superadmin remembering to open Users and filter by "No Role."
2. **IT has no signal that a new hire needs a device.** `it_assets.asset_user_id` (assignment) already exists, but there's no "this employee needs one" flag anywhere for IT to react to.

Both reuse the existing generic notification engine (`docs/NOTIFICATIONS-ARCHITECTURE.md`) as-is — neither needs new dispatch infrastructure, just new triggers + new rule rows, the same recipe every notification since the first one has followed.

## Section A — New-profile onboarding notifications

### The mechanism, and why it still works despite how profiles are actually created

There is **no** `auth.users` trigger in this codebase (confirmed — no `handle_new_user`/`on_auth_user_created` anywhere). Instead, `src/context/AuthContext.jsx`'s `syncProfile()` runs a client-side `upsert()` against `public.profiles` on every session load and every `onAuthStateChange` event — not just first login:

```js
const { error } = await supabase.from("profiles").upsert(
  {
    id: user.id,
    full_name: user.user_metadata?.full_name || null,
    email: user.email,
    avatar_url: avatarAlreadySet ? existingProfile.avatar_url : "/profilePhoto/default.webp",
    updated_at: new Date().toISOString(),
  },
  { onConflict: "id" },
);
```

This payload never sets `role_id`/`department_id` — but that does **not** mean they're `null` on a new row. Confirmed against the live lookup data (`supabase/csv/roles_rows.csv`, `supabase/csv/departments_rows.csv`): both columns default to id `1` — `role_id = 1` is **`staff`**, `department_id = 1` is **`General`** (`GEN`). So a brand-new profile isn't "unassigned" in the sense of having no access at all — it's a real, legitimate `staff` role in a real (if generic) department, until a superadmin moves it. That's the actual first gap: `staff` is very often the *correct* permanent role for a new hire, but `General` is clearly a placeholder bucket nobody's real department should stay as — the department is the field that reliably needs fixing, not necessarily the role.

The second gap is architectural: since this is a client-side `upsert`, not a dedicated "create new user" server-side function, it's tempting to assume a normal `AFTER INSERT` trigger wouldn't reliably distinguish "genuinely new person" from "just refreshed their session." It does, though — Postgres executes `INSERT ... ON CONFLICT (id) DO UPDATE` as a genuine `INSERT` (firing `INSERT` triggers) only on the row's first-ever write; every subsequent call for the same `id` takes the conflict path and executes as an `UPDATE` (firing `UPDATE` triggers instead, if any existed). So a plain `AFTER INSERT ON public.profiles FOR EACH ROW` trigger fires **exactly once** per genuinely-new profile, regardless of how the row was created — no different in reliability from `log_sales_leads_stage_change.sql`'s `AFTER UPDATE` trigger, despite the unusual client-side creation path.

### Three event types, not three recipients on one event

Today's fan-out shares one event's `payload` (`title`/`message`/`link_to`) across every recipient of that `event_type` — there's no per-recipient-group message customization. Since a superadmin, HR, and the new hire themself each need genuinely different message content (not just different audiences for the same message), this is designed as **one trigger emitting three distinct events**, not one event with three targeting rules. This is a normal, already-supported pattern — nothing stops a trigger from calling `emit_notification_event()` more than once.

**`profile.created.needs_department_assignment`** — only fires if the new row is still sitting in the default `General` department:
```sql
if new.department_id = 1 then -- still "General" -- id 1, confirmed via departments_rows.csv
    perform public.emit_notification_event(
        'profile.created.needs_department_assignment', 'profiles', new.id::text,
        jsonb_build_object(
            'profile_id', new.id, 'full_name', new.full_name, 'email', new.email,
            'title', 'New User Needs a Real Department',
            'message', format('%s (%s) signed in for the first time and is still in the default General department -- assign their real department (and role, if they should be a manager) in Users.', new.full_name, new.email),
            'link_to', '/app/system/users'
        )
    );
end if;
```
Recipients: `target_roles: ['superadmin']` — the only role that can actually change `role_id`/`department_id` (per `Users.jsx`'s existing gate). `link_to` points at the bare list, not a per-profile deep link — unconfirmed whether `Users.jsx` supports a `:id`-style URL-synced sidebar the way `EmployeeManagement.jsx` now does (see Section C).

Checking `department_id = 1` rather than `role_id` is deliberate: at the exact moment this trigger fires (profile creation), `department_id` is *always* `1` — nothing else sets it during creation — so the check is really documentation of intent and a guard against a future code path that might one day pre-assign a real department at creation time, in which case this notification should correctly stay silent.

**`profile.created.needs_employee_link`** — always fires (a brand-new profile is essentially never already linked, since `employees.profile_id` can't reference a not-yet-existing profile row):
```sql
perform public.emit_notification_event(
    'profile.created.needs_employee_link', 'profiles', new.id::text,
    jsonb_build_object(
        'profile_id', new.id, 'full_name', new.full_name, 'email', new.email,
        'title', 'New User May Need Linking to an Employee Record',
        'message', format('%s (%s) signed in for the first time. If they have an employee record, link it via the Profile field.', new.full_name, new.email),
        'link_to', '/app/hr/employees/list'
    )
);
```
Recipients: `target_departments: ['HR']` (no role restriction — matches the Employee Management page's own dept-only gate).

**`profile.created.welcome`** — always fires, targets the new person themself via `target_payload_keys`, the exact mechanism already built for `manager_profile_id`:
```sql
perform public.emit_notification_event(
    'profile.created.welcome', 'profiles', new.id::text,
    jsonb_build_object(
        'new_profile_id', new.id,
        'title', 'Welcome to Hyrax Central Portal',
        'message', 'Welcome aboard! Your account is set up — HR and IT have been notified to finish setting up your access.',
        'link_to', '/app/employee/onboarding'
    )
);
```
Recipient rule: `target_payload_keys: ['new_profile_id']`, no role/department targeting at all. `link_to` points at `/app/employee/onboarding` — confirmed live today as the actual index-redirect target of the self-service employee route tree (`src/routes/EmployeeRoutes.jsx`), reachable with no `AccessRoute` gate. It's currently a 7-line stub (`Onboarding.jsx`) — building real content there is a natural next step but is its own separate project, not part of this notification design.

### New files this would need (not created this pass)

- `supabase/triggers/trg_notify_profile_created.sql` — the `AFTER INSERT ON public.profiles FOR EACH ROW` statement.
- `supabase/functions/notify_profile_created.sql` — the trigger function body containing the three `emit_notification_event()` calls above, wrapped the same way `log_sales_leads_stage_change.sql` wraps its own call (nested `exception when others` so a notification failure can never block profile creation itself).
- `supabase/sql_editor/seed_profile_created_notification_rules.sql` — three `insert into notification_rules` rows, one per event type above.

## Section B — IT asset assignment workflow

### New schema: a three-state flag, not a plain boolean

`employees.needs_it_asset boolean` — deliberately **nullable**, not defaulting to `false`:
- `null` = HR hasn't made a decision yet (critical: this is what every existing employee row would have on migration day — a plain `false` default would be indistinguishable from "explicitly doesn't need one," while `null` correctly means "not yet decided" and avoids ever retroactively implying a decision that was never made).
- `true` = needs a device, not yet assigned.
- `false` = HR explicitly decided this employee doesn't need one.

Exposed as a new field on the **existing** Employee Management `tableConfig.jsx` (a `select` editor: "Not Decided" / "Needed" / "Not Needed", or a boolean toggle with a third "unset" state depending on which the shared `Editors.jsx` widget set supports more cleanly) — reusing the CRUD page HR already has. Building a dedicated onboarding checklist/wizard UI is a larger, separate future project, deliberately out of scope here.

### Trigger: Shape A, not Shape B

Unlike the confirmation reminder (a drifting date condition needing a periodic scan), "HR flags this employee needs a device" is a discrete decision made once — a normal `AFTER UPDATE` trigger on `employees`, firing when `needs_it_asset` transitions to `true`:

```sql
if (old.needs_it_asset is distinct from new.needs_it_asset) and new.needs_it_asset = true then
    perform public.emit_notification_event(
        'employee.it_asset_requested', 'employees', new.id::text,
        jsonb_build_object(
            'employee_id', new.id, 'employee_name', new.full_name,
            'title', 'IT Asset Assignment Requested',
            'message', format('%s has been flagged as needing an IT device/asset assigned.', new.full_name),
            'link_to', '/app/it/assets/list'
        )
    );
end if;
```
Recipients: `target_departments: ['IT']` — IT's route gate (`src/routes/ITRoutes.jsx`) has no role restriction on any of its pages, confirmed, so no role narrowing is needed. No dedup column is needed here (unlike the confirmation reminder) — this is a one-time state transition, not a recurring scan, so it can never "re-fire" the way a date-based condition would.

### Resolution is derived, not tracked

"Still needs assignment" is expressed as a query, not a stored flag:
```sql
needs_it_asset = true
and not exists (select 1 from it_assets where asset_user_id = employees.id)
```
`it_assets.asset_user_id` already exists and already backs the IT Assets Overview page's "Unassigned" KPI — it's the single source of truth for whether an employee has been given a device. No second "resolved"/"fulfilled" column is needed on either table; the moment IT sets `asset_user_id` on some asset to point at this employee, they naturally drop out of the "pending assignment" set.

### IT Assets Overview UI change

`src/pages/user/it/ITAssetManagement/overview/ITAssetOverview.jsx` currently has no backing SQL RPC at all — its KPIs (including the existing "Unassigned" tile) are computed entirely client-side in `useITAssetsOverview.js` from a plain `supabase.from("it_assets").select(...)`. A new "Pending Assignments" KPI — the demand-side complement to the existing supply-side "Unassigned" tile — would follow the same convention rather than introducing a new RPC pattern into a page that's deliberately never used one: fetch `employees` rows where `needs_it_asset = true`, cross-reference against the already-fetched `it_assets` rows' `asset_user_id` values (same `useMemo` shape `unassignedAssets` already uses), and surface both a KPI tile and a drill-down list so IT can click through and actually assign an asset — mirroring how `riskAssets`/`unassignedAssets` are already returned from the hook for drilldown use.

## Section C — Open questions to resolve before implementation

- **Does `Users.jsx` support a per-profile URL-synced sidebar yet?** Not confirmed. If not, `profile.created.needs_department_assignment`'s `link_to` stays a bare list link until/unless `Users.jsx` gets the same URL-sync treatment `EmployeeManagement.jsx` already received (`docs/` has no tracked precedent confirming this one way or the other — verify before building).
- **Follow-up reminder if IT doesn't act.** The initial `employee.it_asset_requested` notification is one-shot (Shape A). If a request could plausibly sit unactioned for days, a second, Shape-B rule (scheduled scan over `needs_it_asset = true` rows with no matching `it_assets.asset_user_id`, past N days) would layer cleanly on top — not needed for the initial notification, and not designed in detail here since there's no evidence yet that IT actually misses these.
- **Dollar thresholds for every "large X" event** across Sales/Finance (see `NOTIFICATION-RULES-TRACKER.csv`) are explicitly left as `TBD` — a business decision, not something to guess.

## Non-goals

- Not building a dedicated onboarding checklist/wizard UI (either the HR-admin-side "Onboarding Management" or the employee-self-service `/app/employee/onboarding` page beyond its current stub) — both are separate, larger projects.
- Not adding a real "admin" role or any new role beyond `staff`/`manager`/`superadmin` — `profile.created.needs_department_assignment` targets `superadmin` specifically because that's the only role that can act on it today.
- Not replacing or duplicating `hyrax-data-platform`'s Discord alerting anywhere in this doc.
