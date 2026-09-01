# Employee Lifecycle Checklist Architecture

**Status:** Proposed — design only (2026-09), no schema/triggers/UI built yet. Supersedes the "dedicated onboarding checklist/wizard UI" exclusion in [`ONBOARDING-WORKFLOW-ARCHITECTURE.md`](./ONBOARDING-WORKFLOW-ARCHITECTURE.md)'s Non-goals section — that is now this project — and resolves that doc's own open TODO about offboarding, which had zero prior art (no doc, table, route, or code) anywhere in this repo or the sibling `hyrax-data-platform` repo before this design. Builds directly on top of that doc's Section A (live) and Section B (designed, not built), and reuses the notification engine from [`NOTIFICATIONS-ARCHITECTURE.md`](./NOTIFICATIONS-ARCHITECTURE.md) and UI/data-model patterns established in [`PROJECTS-TASKS-ARCHITECTURE.md`](./PROJECTS-TASKS-ARCHITECTURE.md) (Workspace Tasks) as-is, without changing either.

## The problem

`ONBOARDING-WORKFLOW-ARCHITECTURE.md` designs *notifications* for a handful of discrete moments in a new hire's setup (a profile needing a department, an employee needing linking, IT needing to know a device is required) — but nobody, not HR, not IT, not the new hire themself, has anywhere to look and see the *whole picture* of where one specific person's onboarding actually stands right now. The doc's own "Full Proper Onboarding Lifecycle" section lists an 11-step flow and then trails off into an undesigned "new hire should undergo HR onboarding, IT onboarding" phase with no checklist behind it at all.

Offboarding is worse: it doesn't exist. There's no signal anywhere that revokes access, returns equipment, or closes out HR/finance obligations when someone resigns or is terminated — nothing beyond the bare fact that `employees.employment_status_id` eventually gets set to a terminal value, usually well after the fact. The existing doc's own blockquoted TODO names this directly: *"HR side of things that would help in offboarding properly... what other things are missing from this onboarding that is essential... and would aid in proper offboarding procedures."*

This document designs one feature that answers both: a shared, always-current **checklist per employee per lifecycle event** (onboarding or offboarding), visible to HR, IT, and the employee, each seeing the parts relevant to them.

## Why one unified case, not separate HR/IT checklists

The natural-seeming alternative — an "HR onboarding checklist" and a separate "IT onboarding checklist" — was rejected. The 11-step flow already documented alternates ownership constantly: HR creates the employee row, IT creates the Workspace account, HR *and* IT link the profile, IT *or* superadmin assigns role/module access. Two independently-modeled checklists would need their own synchronization mechanism to answer "has the other side finished yet" — exactly the coordination failure the existing doc's own intro complains about ("nobody is told when a new person shows up").

This app has already solved the equivalent problem once, deliberately, in `PROJECTS-TASKS-ARCHITECTURE.md`: **visibility and permission tier are separate axes.** Every project member (owner/lead/member/cc) sees the same task list; only who can *act* on a given task differs (assignee-only). This design applies the identical split: one case per employee per lifecycle event, one checklist of items inside it, each item tagged with an `owner` (`HR` / `IT` / `superadmin` / `employee` / `system`). HR's view, IT's view, and the employee's own view are each a **filtered slice of the same case** — never three copies of "what's the state of this person's setup" that can silently drift apart.

## Scope decisions locked in for v1

Four constraints, confirmed with the product owner, shape every choice below:

1. **This document is the deliverable of this pass.** No schema, triggers, or UI ship this round — this is the buildable spec for a later implementation pass.
2. **Automation is portal-native only.** Anything expressible inside this app's own Postgres database — status derived from a real fact, a notification fired — is fair game. No real third-party API integration (no Google Workspace Admin SDK calls, no GitHub API calls) is designed here; every external-system step (creating a Workspace account, revoking a GitHub seat) stays a manual human action, checked off in the portal after being notified, exactly like every other automation already built in this codebase.
3. **Offboarding formally begins at resignation/notice submission**, before the employee's actual last day — giving HR/IT lead time to prepare, so access is revoked *on* the last day rather than sometime after it.
4. **The checklist is fixed and built-in for v1** — one hardcoded onboarding checklist, one hardcoded offboarding checklist, identical for every employee. No admin UI to author custom items or per-department templates exists in this design; item definitions live in code, not in an editable database table.

## Data model

### `employee_lifecycle_cases`

One row per onboarding or offboarding attempt for one employee.

| column | type | notes |
|---|---|---|
| `id` | bigint PK | |
| `employee_id` | bigint FK → `employees(id)` | Anchored on `employees`, not `profiles` — an onboarding case starts (HR creates the employee row) before a `profiles` row exists at all, per the existing flow's own step ordering. Every other assignment-style table in this schema (`it_assets.asset_user_id`, `attendance_activities.employee_id`) already anchors on `employees` for the same reason. |
| `case_type` | enum `lifecycle_case_type`: `ONBOARDING`, `OFFBOARDING` | Native Postgres enum, matching how `tasks.status`/`projects.status` are already typed in `projects_tasks_schema_migration.sql`. |
| `status` | enum `lifecycle_case_status`: `OPEN`, `COMPLETED`, `CANCELLED` | |
| `opened_at` | timestamptz default `now()` | |
| `opened_reason` | text | Audit trail of which trigger condition fired, e.g. `employee_row_inserted`, `resignation_date_set`, `status_terminated_notice`, `status_terminal_direct`. |
| `expected_last_day` | date, nullable | Offboarding only. Seeded from `employees.resignation_date`/`end_date` if present; HR-editable afterward. Lives on the case, not as a new `employees` column, because it describes this specific separation event, not a standing fact about the employee. |
| `employee_can_view` | boolean default `false` | Offboarding only in practice (always `true` for onboarding, set at creation). See "Employee self-service" below — a case-level gate independent of any single item's visibility. |
| `closed_at` | timestamptz, nullable | |
| `closed_reason` | text, nullable | e.g. `all_items_complete`, `resignation_retracted`. |
| `it_revocation_reminder_last_notified_at` | timestamptz, nullable | Shape-B cooldown dedup, see Notifications. |
| `overdue_last_notified_at` | timestamptz, nullable | Shape-B cooldown dedup, see Notifications. |

A **partial unique index** `(employee_id, case_type) WHERE status = 'OPEN'` is the hard invariant enforcing "at most one open case of a given type per employee" — the same pattern `project_members`' partial unique index already uses to enforce exactly one project owner. A rehire is assumed to produce a brand-new `employees` row (there is no employment-history table anywhere in this schema supporting multiple stints on one row), so it naturally opens a fresh onboarding case through the same insert trigger — no case-reopening mechanism is designed or needed.

### `employee_lifecycle_case_items`

One row per checklist item per case.

| column | type | notes |
|---|---|---|
| `id` | bigint PK | |
| `case_id` | bigint FK → `employee_lifecycle_cases(id)` | |
| `item_key` | text | Matches a key 1:1 in a fixed JS config file — see "Where item definitions live" below. |
| `status` | enum `lifecycle_item_status`: `PENDING`, `IN_PROGRESS`, `DONE`, `SKIPPED` | |
| `completed_at` | timestamptz, nullable | |
| `completed_by` | uuid FK → `profiles(id)`, nullable | Null for system-derived completions. |
| `notes` | text, nullable | |
| `owning_department_sub` | text, nullable | Stamped from the same fixed config at seed time. Exists purely so RLS can enforce "only IT can write IT-owned items, only HR can write HR-owned items" — without it, ownership would exist only inside a JS file Postgres has no way to check. **Flagged as an implementation-time call**: if per-item write granularity turns out not to matter (a coarser "HR or IT, no per-item distinction" policy is good enough), this column can be dropped with no other change to this design. |

Unique constraint on `(case_id, item_key)`.

### Item status set: four values, not five

`PENDING` / `IN_PROGRESS` / `DONE` / `SKIPPED` deliberately mirrors `tasks.status`'s own four-value shape (`TO_DO`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`), renamed for checklist semantics. There is **no** `BLOCKED` value: whether item B can meaningfully start before item A finishes is a fixed ordering fact already knowable from the item's position in the JS config (plus a lightweight "depends on" hint), not a state that needs its own database row — a greyed-out "waiting on X" badge in the UI is a client-side computation from that ordering and the sibling item's live status, the same "derive, don't duplicate" instinct already applied everywhere else in this design.

`SKIPPED` covers two situations that mean the same thing operationally — "explicitly not applicable to this employee" (system-seeded) and "a human decided to skip this one" (rare, always with a note) — both excluded from what's required for case completion, with an auditable reason. A fifth `N/A` value would be redundant with this.

### Seeding every item, even non-applicable ones

Every case is seeded with a row for **every** item in its fixed set at creation time — including ones that don't apply to this particular employee (e.g. `device_access_card_ready` when `employees.needs_it_asset` is `false`/`null`), inserted immediately as `SKIPPED` with an auto-generated note (`needs_it_asset is not true`). This means HR and IT always see the *full* standard checklist for every employee, with some rows greyed out and a visible reason, rather than a checklist whose length silently varies person to person — the shape real audit and review actually wants ("did we even consider a device for this person") over one optimized purely for a shorter list.

### Where item definitions live

Per scope decision #4 (fixed checklist, not admin-configurable), item definitions — key, label, owner, `employee_visible` flag, applies-if condition, sort order — live in two new plain JS config files, `src/data/onboardingChecklistMeta.js` and `src/data/offboardingChecklistMeta.js`, mirroring the existing convention `src/features/workspace/tasks/private/taskStatusMeta.js` already established for `TASK_STATUS_ACTIONS`. The database only ever stores per-case, per-item *state* (the `employee_lifecycle_case_items` columns above) — never a duplicate copy of the label/owner/config data, the same division of responsibility `tasks.status`'s hardcoded action map already keeps clean of the database.

## Derived vs. manual completion

The rule is a hard line, not a per-item judgment call: an item is **DERIVED** only if the fact it represents already lives on an existing table and is reachable from a Postgres trigger without calling any external system. Everything requiring a human to have actually done something outside this database — created a Google account, handed over a laptop, run a payroll settlement — is **MANUAL**, per scope decision #2.

### Onboarding checklist (12 fixed items)

| item_key | label | owner | class | applies if | notes |
|---|---|---|---|---|---|
| `hr_documents_collected` | Personal details & statutory documents collected | HR | Manual | always | IC/passport, bank details, EPF/SOCSO, emergency contact |
| `hr_onboarding_briefing` | HR onboarding briefing completed | HR | Manual | always | Policies, code of conduct, benefits overview |
| `workspace_account_created` | Google Workspace account created | IT | Manual | always | Account + relevant email groups; no Admin SDK integration |
| `personal_email_notified` | New hire notified via personal email | IT | Manual | always | |
| `portal_invite_sent` | Portal invite sent to work email | IT | Manual | always | |
| `device_access_card_ready` | Device/access card prepared | IT | Manual | `needs_it_asset = true` | Procurement/prep, distinct from system assignment below |
| `it_asset_assigned` | IT asset assigned in system | IT | **Derived** | `needs_it_asset = true` | `EXISTS (SELECT 1 FROM it_assets WHERE asset_user_id = employees.id)` — the literal Section B query |
| `device_handed_over` | Device/access card handed over | IT | Manual | `needs_it_asset = true` | Physical handover can lag system assignment |
| `it_onboarding_briefing` | IT onboarding briefing completed | IT | Manual | always | Systems, security policy, tools walkthrough |
| `software_access_provisioned` | Software/system access provisioned | IT | Manual (free-text notes) | always | See "Software/license inventory" below |
| `profile_linked` | Profile linked to employee record | HR/superadmin | **Derived** | always | `employees.profile_id IS NOT NULL` — the exact fact `employee.profile_linked` already watches |
| `role_department_assigned` | Real role/department assigned | superadmin | **Derived** | always | `profiles.role_id <> 1 OR profiles.department_id <> 1` — the exact fact `profile.department_role_assigned` already watches |

### Offboarding checklist (13 fixed items)

| item_key | label | owner | class | applies if | notes |
|---|---|---|---|---|---|
| `resignation_acknowledged` | Resignation/notice acknowledged, last day confirmed | HR | Manual | always | |
| `exit_interview_completed` | Exit interview completed | HR | Manual | always | |
| `handover_plan_documented` | Handover plan documented | HR | Manual | always | Knowledge transfer / successor assignment — see rationale below |
| `leave_balance_settled` | Leave balance settled | HR | Manual | always | Live balance can be *shown* from `leave_ledger_entries` as a read-only aid; the actual encashment/settlement stays a manual confirmation — no payment execution exists in-app |
| `final_settlement_processed` | Final settlement processed | HR | Manual | always | No payroll engine exists in this app; stays a manual HR confirmation |
| `statutory_benefits_cessation` | Statutory benefits cessation notified | HR | Manual | always | EPF/SOCSO/insurance |
| `certificate_of_service_issued` | Certificate of service issued | HR | Manual | always | |
| `employee_file_closed` | Employee file closed | HR | Manual | always | Final archival step |
| `it_assets_returned` | IT assets returned | IT | **Derived** | ≥1 `it_assets` row was assigned at case-open | `NOT EXISTS (SELECT 1 FROM it_assets WHERE asset_user_id = employees.id)` — the exact inverse of onboarding's `it_asset_assigned`. Covers both device and access-card return, since IT asset categories are already an open, extensible lookup table |
| `software_access_revoked` | Software/system access revoked | IT | Manual (free-text notes) | always | References notes left in the onboarding `software_access_provisioned` item |
| `workspace_account_revoked` | Google Workspace account revoked | IT | Manual | always | No API integration; manual confirmation |
| `credentials_rotated` | Shared/admin credentials rotated | IT | Manual | employee's `role_id IN (2,3)` OR department is `IT`/`FIN` | Conditionally seeded — see rationale below |
| `portal_account_deactivated` | Portal account deactivated | IT/superadmin | **Derived** | always | New `profiles.deactivated_at` column set — see below |

Note the asymmetry: onboarding has 3 derived items of 12; offboarding has only 2 of 13. That's the honest consequence of onboarding already having purpose-built portal-native signals (`profile_id`, `role_id`/`department_id`, `it_assets.asset_user_id`) that offboarding's real-world actions (payroll, exit interviews, account revocation) simply don't have equivalents for — manufacturing fake derived state there would violate scope decision #2, not honor it.

## Case lifecycle triggers

### Onboarding case creation

`AFTER INSERT ON public.employees FOR EACH ROW`:

```sql
if new.employment_status_id = 3                              -- 'Probation'
   or new.join_date >= current_date - interval '30 days'      -- belt-and-suspenders
then
    perform public.get_or_create_onboarding_case(new.id, 'employee_row_inserted');
end if;
```

The guard matters specifically because `hyrax-data-platform` is expected to eventually bulk-migrate historical HR data into this schema (per `CLAUDE.md`'s own module-status note) — that migration must not spawn thousands of onboarding cases for people who've worked here for years. Checking `employment_status_id = 3` (Probation) is the same "guard as documentation of intent" style `profile.created.needs_department_assignment`'s `department_id = 1` check already uses: a genuine new hire is virtually always inserted as Probation; a migrated historical row would carry whatever real status it currently holds, essentially never Probation on day one of a migration.

### Offboarding case creation — three conditions, deliberately overlapping

`AFTER UPDATE ON public.employees FOR EACH ROW`:

```sql
if (new.resignation_date is not null and old.resignation_date is distinct from new.resignation_date)
   or (new.employment_status_id = 13 and old.employment_status_id is distinct from 13)   -- 'Terminated Notice'
   or (exists (select 1 from employment_status es
               where es.id = new.employment_status_id and es.category = 'terminated')
       and old.employment_status_id is distinct from new.employment_status_id)
then
    perform public.get_or_create_offboarding_case(new.id, <matching opened_reason>);
end if;
```

Three branches, each covering a real separation path scope decision #3 requires:

1. **`resignation_date` newly set** — the normal voluntary-resignation path, and the earliest possible signal regardless of whether HR also changes the status in the same edit. This gives IT/HR the most lead time, which is the entire point of "offboarding starts at notice, not at the last day."
2. **Status transitions to 13 ("Terminated Notice")** — an involuntary-but-with-notice separation where HR moves status straight to Notice without necessarily setting `resignation_date` (a field name that implies voluntary resignation, and shouldn't be forced for a company-initiated notice period).
3. **Status transitions directly to any `employment_status.category = 'terminated'` value** (joined by `category`, the same style `check_employee_contract_actions_due.sql` already uses rather than hardcoding ids) — covers a summary/immediate termination with no notice period at all. This branch fires the instant status finalizes, with no dependency on ever passing through Notice first, since a summary termination by definition never will.

`get_or_create_offboarding_case()` is idempotent against the partial unique index, so branches firing together on the same `UPDATE` (HR commonly sets `resignation_date` and status=13 in one edit) never double-open a case, and branch 3 firing later against an already-open case from branch 1/2 is a no-op — the same case simply continues toward closure.

### Retracted resignation — closing the loop

A companion condition in the same trigger function: if there is a currently `OPEN` offboarding case and `new.resignation_date IS NULL AND old.resignation_date IS NOT NULL` and the new status's category is `active`, auto-cancel the case (`status = 'CANCELLED'`, `closed_reason = 'resignation_retracted'`). This is the direct offboarding analogue of Section A's own "closing the loop" philosophy — nobody should have to remember to manually cancel a stale offboarding case.

### Case completion (both types, one mechanism)

`AFTER UPDATE OF status ON public.employee_lifecycle_case_items FOR EACH ROW`:

```sql
if new.status in ('DONE','SKIPPED') then
    if not exists (
        select 1 from employee_lifecycle_case_items
        where case_id = new.case_id and status not in ('DONE','SKIPPED')
    ) then
        update employee_lifecycle_cases
            set status = 'COMPLETED', closed_at = now(), closed_reason = 'all_items_complete'
            where id = new.case_id and status = 'OPEN';
    end if;
end if;
```

"Complete" means every seeded item (including `SKIPPED` ones) reaches `DONE`/`SKIPPED` — there is no separate required-vs-optional item tier for v1, matching the fixed-checklist brief. Because this fires on the item table itself, it's agnostic to whether the last item to finish was a manual checkbox tick or a derived-item sync — one completion mechanism, not two. This is a deliberate departure from Workspace Projects' manual-only completion ("a project can be fully task-complete and still waiting on sign-off"): a checklist's "done" is a mechanical AND of already-verified facts, with no separate judgment call left to make once every fact is true.

## Reconciling with Section A/B — sync triggers, not replacements

The open question this design has to resolve: a derived item's `status` must exist as a real row (so case-completion has one uniform mechanism to check), but the fact it derives from lives on `employees`/`profiles`/`it_assets`, changed through code paths that already have their own triggers (Section A/B). The answer is to add small, single-purpose **sibling** triggers at the exact same firing points Section A/B already use — never editing those existing trigger functions — whose only job is to sync a case-item row:

- `sync_lifecycle_item_on_profile_linked()` — new `AFTER INSERT OR UPDATE OF profile_id ON public.employees` trigger, coexisting with `notify_employee_profile_linked`'s own trigger on the identical event (Postgres fires multiple triggers on the same table/event without conflict). Marks the `profile_linked` item `DONE` for that employee's open onboarding case.
- `sync_lifecycle_item_on_role_department_assigned()` — new sibling trigger alongside `notify_profile_updated`'s `AFTER UPDATE ON public.profiles`, same `IS DISTINCT FROM` condition, marks `role_department_assigned` `DONE`.
- `sync_lifecycle_item_on_it_asset_assignment()` — new trigger on `AFTER INSERT OR UPDATE OF asset_user_id ON public.it_assets` (Section B never needed one, since its KPI was query-time only): a newly-set `asset_user_id` marks that employee's onboarding `it_asset_assigned` item `DONE`; a cleared/reassigned `asset_user_id` re-checks the *former* employee's offboarding `it_assets_returned` item, marking it `DONE` only once no other `it_assets` row still points at them.
- `sync_lifecycle_item_on_profile_deactivated()` — new trigger on `AFTER UPDATE OF deactivated_at ON public.profiles`, marks `portal_account_deactivated` `DONE`.

This is the same pattern `tasks.start_date`/`completed_date` already establish ("plain columns auto-stamped by a trigger the moment status reaches a matching value"), applied one layer removed — materializing into a sibling table's row instead of a column on the same row. It keeps "derive, don't duplicate" intact: the case-item's status is still 100% computed from the real fact at the instant that fact changes; it's just also written down for uniform querying.

**Section A and Section B stay completely untouched** by this design: `notify_profile_created.sql`, `notify_profile_updated.sql`, `notify_employee_profile_linked.sql`, and `link_profile_to_employee.sql` are not modified — new sibling triggers only observe the same events. Section B's `needs_it_asset`/`employee.it_asset_requested` design is reused verbatim, including its exact resolution query, not re-implemented.

**`portal_account_deactivated` needs one new column**: `profiles.deactivated_at timestamptz`, nullable, set via a new `SECURITY DEFINER` RPC (`deactivate_profile(p_profile_id uuid)`) mirroring `link_profile_to_employee.sql`'s own `role_id = 3` authorization pattern. Whether this should also call Supabase's own Auth Admin API to actually block login (still portal-native, not a third-party integration) is left as an implementation-time decision, not designed further here.

## Notifications

Six new event types, logged in [`NOTIFICATION-RULES-TRACKER.csv`](./NOTIFICATION-RULES-TRACKER.csv) as `Proposed`:

| event_type | shape | trigger condition | audience |
|---|---|---|---|
| `employee.offboarding_case_opened` | A | Fires from inside the offboarding case-open trigger | HR dept + the departing employee's manager (`target_payload_keys: manager_profile_id`, same mechanism as `employee.confirmation_due_soon`) |
| `employee.offboarding_it_revocation_needed` | A | Second `emit_notification_event()` call from the same trigger, distinct deadline-focused message | IT dept |
| `employee.onboarding_checklist_completed` | A | Case-completion trigger fires with `case_type = 'ONBOARDING'` | HR dept + the new hire themself (`target_payload_keys: new_profile_id`, once `profile_linked` guarantees a `profiles.id` exists) |
| `employee.offboarding_case_completed` | A | Case-completion trigger fires with `case_type = 'OFFBOARDING'` | HR dept + superadmin |
| `employee.offboarding_last_day_approaching` | B, daily scan | Open case, `expected_last_day` within 7 days, IT items not all done, cooldown ≥3 days | IT dept |
| `employee.offboarding_overdue` | B, daily scan, 7-day cooldown | Open case, `expected_last_day` already passed, cooldown ≥7 days | HR + IT dept + superadmin, mirroring `check_employee_confirmations_overdue.sql`'s cooldown shape |

One trigger emitting several distinct events for different audiences is the established pattern (`notify_profile_created.sql` already emits three). **Existing events are consumed, not duplicated**: `profile.created.needs_employee_link`, `profile.created.welcome`, `employee.it_asset_requested`, `profile.department_role_assigned`, and `employee.profile_linked` all keep firing exactly as designed today — this system never re-notifies for any of them, it materializes their underlying facts into case-item rows so the checklist has something uniform to render.

The 7-day cooldown and 7-day "approaching" window are reasonable strawmen, not confirmed business decisions — flagged as TBD, matching `NOTIFICATION-RULES-TRACKER.csv`'s existing convention for unresolved dollar thresholds elsewhere in the tracker.

## Access control & UX

### Routes

- `hr/onboarding`, `hr/offboarding` — new entries in `HRRoutes.jsx`, `<AccessRoute departments={["HR"]}>`. `hr/onboarding` reactivates an already-dead nav slot: `sideNavLinkData.js` has a commented-out "Onboarding Management" entry, and `route_access_matrix.csv` already classifies it `unbuilt-config` — this design fills a pre-existing gap, not an invented one.
- `it/onboarding`, `it/offboarding` — new entries in `ITRoutes.jsx`, `<AccessRoute departments={["IT"]}>`, matching `it/assets`/`it/dashboard`'s existing gate exactly.
- No new `SuperadminRoutes.jsx` entry — superadmin already bypasses every `AccessRoute` check via `canAccess()`'s blanket bypass, reaching the same case through either the HR or IT URL. A superadmin-targeted notification's `link_to` should point at the HR URL by convention, mirroring how `profile.created.needs_department_assignment`'s `link_to` already points superadmin at `/app/system/users`.
- Both the HR and IT URL for the same case mount one shared case-detail component, which reads `useAccessControl()`'s department/role to decide which items are actionable for the current viewer — this is what makes "one unified case" real in the UI, not only in the schema.

### Who can act on what

Every viewer who can open the page sees the **entire** checklist, including items they can't act on — rendered read-only for the department that doesn't own them (the same pattern `ProjectTasksTab.jsx` already uses to show a task to non-assignees as visible-but-inert). Only the item's `owner` department (or superadmin) can flip its status. `SKIPPED`/system-derived items are never manually touched by anyone.

**Manager involvement is notification-only for v1** — no dedicated manager view or checklist ownership tier. The existing flow doc never lists a manager as an onboarding actor, and there's no evidence yet that more than a heads-up is needed: the departing/new employee's manager (`employees.manager_id` → that manager's `profile_id`, the exact `manager_profile_id` payload-key pattern already built for `employee.confirmation_due_soon`) gets exactly two notifications — onboarding, once portal access is granted; offboarding, when the case opens (the same lead time HR/IT get). Adding a third visibility tier here (echoing Workspace's `owner`/`lead`/`member`/`cc`) would be scope creep against the fixed-checklist, no-admin-authoring brief.

### Employee self-service: read-only, two-layer visibility gate

**The employee never checks off any item themselves**, for either onboarding or offboarding — both self-service views are pure display. This removes an entire class of problems (an employee falsely self-certifying "I returned my laptop," write-authorization edge cases onto HR/IT-authoritative records) and matches how every existing page under `EmployeeRoutes.jsx` today is either pure display or a request-for-someone-else-to-approve flow, never a direct write onto an authoritative record.

`/app/employee/onboarding` (today a bare stub, `function Onboarding() { return <div>Onboarding</div>; }`) becomes a read-only view of the employee's current open onboarding case, simplified into roughly four rollup milestones rather than raw internal item labels — a new hire doesn't need to read "HR create employee row with device/access-card requirement flags" verbatim:

1. Personal details received
2. Account & access being set up
3. Device/access-card handover (only shown if `needs_it_asset = true`)
4. Welcome & orientation

A sibling `employee/offboarding` route is built the same way. Neither route is added to the permanent sidenav (`sideNavLinkData.js`'s `EMPLOYEE` segment) — most employees never have an open case, so an always-visible, almost-always-empty nav entry is clutter. Both are reached via notification `link_to` deep links, the same convention every other self-service page in this app already uses.

**Offboarding visibility needs an extra gate the sensitive scenario demands.** An offboarding case can legitimately be opened internally (HR recording a decision, starting IT's lead time) *before* the employee has been formally told, especially for an involuntary termination. Two layers, together:

- **Case-level**: `employee_can_view` (boolean, default `false`) — flipped on explicitly by HR once the employee has actually been informed. Nothing on the employee's offboarding page renders at all until this is `true`.
- **Item-level**: a fixed `employee_visible` flag per item in the JS config, independent of `owner`.

Worked recommendation for the offboarding checklist:

| item | `employee_visible` | why |
|---|---|---|
| `resignation_acknowledged` | No | Surfaced instead as a plain header field ("Last working day: [date]") once `employee_can_view = true`, not a checklist row |
| `it_assets_returned` | **Yes** — "Please return your [device] and access card by [date]" | Direct, low-sensitivity commitment to the employee |
| `final_settlement_processed` | **Yes** — "Your final pay will be processed by [date]" | Directly relevant to the employee |
| `exit_interview_completed` | Yes | Routine, low-sensitivity, the employee directly participates |
| `handover_plan_documented` | No | Internal operational content |
| `software_access_revoked` / `workspace_account_revoked` / `credentials_rotated` | No | Revealing exact revocation timing to a departing employee is a real security risk |
| `statutory_benefits_cessation`, `certificate_of_service_issued`, `employee_file_closed`, `leave_balance_settled` | Yes | Routine HR process items the employee has a direct stake in |

### List/detail UX

Overview page per domain (`hr/onboarding`, `it/onboarding`, and the offboarding equivalents): `OverviewCards` KPI row (Open Cases, Completed This Month, Stuck > N Days — the same component already used elsewhere, e.g. Employee Management's overview tab) above a card list grouped by case status via the existing `StatusTab`/`buildStatusTabs` helper (Open / Completed / Cancelled tabs — the same shape `TASK_STATUSES` already gives Workspace Tasks). A new `CaseCard` component, modeled directly on `TaskCard.jsx`: employee photo/name, a status badge, days-open, an inline `ProgressBar` (`completed / total` items — the same component `ProjectDetailLayout.jsx` already uses), and a "waiting on: IT" badge computed from the first not-yet-done item's owner in sequence order.

Detail page modeled directly on `ProjectDetailLayout.jsx`: a header card (photo, status badge, opened-date, `ProgressBar`) followed by the checklist as an ordered list of new `ChecklistItemCard`s — item label, an owner badge, and a single forward-only "Mark Done" (+ "Undo" once done) action, gated by the viewer's department matching the item's owner, reusing the existing confirm-before-mutate interaction shape (`useTaskStatusAction.js`'s `requestStatusChange` → `ActionModal` confirm → `confirmAction`) as a new equivalent hook. Editing the case's own metadata (e.g. correcting a recorded last day) uses a small `DataSidebar` panel from the header, the same way `ProjectDetailLayout.jsx` already separates project-metadata editing from its task list.

**Not** a flat `DataTable`/`DataSidebar` form for the checklist itself — the wrong shape once there's an orderable, independently-actionable list of sub-items to render, the same reasoning that already led Workspace to build a dedicated tasks tab instead of cramming a task list into a single-entity form. **Not** a stepper matching the 11-step flow verbatim — several of those steps are pure notification side effects, not human-actionable items, so a hardcoded "step 6 of 11" would misrepresent the real actionable-item count and drift the moment the flow doc's own step list changes. **Not** a Kanban/drag-and-drop board — this app has already made and stated this exact scope cut for the strictly larger Workspace module ("List-only view for v1... strictly time-boxed to avoid over-engineering... no drag-and-drop board"); nothing suggests this smaller feature needs more visual richness than that precedent already rejected.

### Where this ends

A case auto-completes (per the trigger above) and stays reachable afterward, moved into the Completed status tab rather than archived out of reach. Probation/confirmation-due tracking (`employee.confirmation_due_soon`/`_overdue`, already built, with its own `confirmations_due_soon_count` KPI tile) is **explicitly not folded into this checklist** — it's a structurally different concern, a single rolling deadline with escalating reminders, not a finite ordered set of one-time setup actions. Forcing it into "checklist item #13" would misrepresent a waiting period that resolves on its own as if it were a task someone completes.

The one connective thread, answering "how does anyone know what's next" without rebuilding the employee lifecycle dashboard: a completed onboarding case's detail page shows one additional **read-only** info line, sourced from the same `employees.confirmation_due_date` the existing KPI tile already reads — "Probation review due: [date]." A label, not an interactive item, and not a new notification (that notification already exists and fires on its own independent schedule).

## Offboarding checklist — practitioner rationale

Beyond what's already justified in the item tables above:

- **`handover_plan_documented`** is the single highest-value addition beyond what the existing doc's TODO named. A departing employee's institutional knowledge walking out the door uncaptured is the most common real-world offboarding failure, and nothing in the schema hinted at it before this design. It stays deliberately unstructured (free-text, HR-owned) rather than a sub-checklist, matching the fixed/simple v1 brief.
- **`credentials_rotated` is conditionally seeded**, not shown for every departure — a real practitioner distinction: shared/admin credential rotation matters specifically for people who plausibly had elevated or financially sensitive access. Showing it unconditionally for every junior staff departure would just be checklist noise that erodes trust in the list.
- **Physical items** (device, access card) both derive from the identical `it_assets.asset_user_id` fact already central to Section B — no new physical-return tracking mechanism is needed, only the mirror-image query of the one Section B already specifies.

### Software/license inventory — explicitly scoped out

The existing doc's TODO explicitly asks for software-assignment tracking "so during offboarding, everything can be checklisted." Building a real `software_licenses`/`employee_software_grants` table now would be exactly the kind of speculative infrastructure `PROJECTS-TASKS-ARCHITECTURE.md`'s own "strictly time-boxed, avoid over-engineering" precedent argues against — what counts as a license, per-seat vs. per-org assignment, renewal dates, none of that is known yet with real specificity. Instead, a free-text `notes` field on `software_access_provisioned` (onboarding) and `software_access_revoked` (offboarding) gives IT a lightweight paper trail today. This is a **named future gap**, not an oversight: if a real inventory need shows up later with concrete requirements, it slots in the same way `task_status_history` was flagged as a future addition *alongside* the plain-column pattern, not a redesign of it.

## Non-goals

- **No schema/DDL/RLS SQL is written in this pass** — table/column names and trigger conditions above are the buildable spec for a later implementation pass, not finished migrations.
- **No admin-configurable checklist templates or template-editor UI.** Item definitions are fixed in code per scope decision #4.
- **No manager-facing dedicated view or checklist ownership tier** — notification-only, per "Who can act on what" above.
- **No employee write/check-off capability**, for either checklist — both self-service views are read-only by deliberate design, not an oversight to revisit lightly.
- **No real software/license inventory system** — a free-text notes field is the v1 answer; a real inventory table is a named future gap.
- **No external API integrations** (Google Workspace Admin SDK, GitHub, etc.) — every manual item stays a human-checked box in the portal, per scope decision #2.
- **No payroll/final-settlement calculation logic** — `final_settlement_processed` stays a manual HR confirmation; no payroll engine exists anywhere in this app.
- **No changes to the existing probation-confirmation notification system** — it stays entirely separate, per "Where this ends" above.
- **No mobile-specific layout or notification-preferences work** for this feature specifically — both are cross-cutting concerns already tracked as generic roadmap items in `NOTIFICATIONS-ARCHITECTURE.md`.
- **No modeling of multiple employment stints/rehire history on `employees`** — a rehire is assumed to produce a new employee row; no case-reopening mechanism is designed.
- **Reminder cooldown day-counts** (7 days, used above) are a reasonable strawman, not a confirmed business decision — flag for confirmation before implementation, matching the tracker CSV's existing convention for unresolved thresholds elsewhere.

## What an implementation pass would touch

Informational only — not built in this pass:

- **New tables/columns**: `employee_lifecycle_cases`, `employee_lifecycle_case_items`, `profiles.deactivated_at`.
- **New functions/triggers**: `get_or_create_onboarding_case()`, `get_or_create_offboarding_case()`, the offboarding case-open trigger (three conditions + retraction), `check_lifecycle_case_completion()`, the four sync triggers listed under "Reconciling with Section A/B," `deactivate_profile()` RPC, two new `pg_cron` scan functions for the Shape-B notifications.
- **New frontend files**: `src/data/onboardingChecklistMeta.js`, `src/data/offboardingChecklistMeta.js`, new routes in `HRRoutes.jsx`/`ITRoutes.jsx`/`EmployeeRoutes.jsx`, a shared case-detail component, `CaseCard`, `ChecklistItemCard`, feature modules under `src/features/hr/lifecycleCases/` and `src/features/it/lifecycleCases/` following the existing `features/<domain>/<entity>/{private,public}/{api,hooks}` convention, a rebuilt `src/pages/user/employee/onboarding/Onboarding.jsx` and new `employee/offboarding` page.
- **New docs**: a companion `docs/setup/EMPLOYEE-LIFECYCLE-CHECKLIST-DEPLOYMENT-GUIDE.md`, matching the naming convention of `PROFILE-ONBOARDING-NOTIFICATIONS-DEPLOYMENT-GUIDE.md`/`WORKSPACE-STATUS-NOTIFICATIONS-DEPLOYMENT-GUIDE.md`.
