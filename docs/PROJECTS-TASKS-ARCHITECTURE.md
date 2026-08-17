# Projects & Tasks Architecture

**Status:** Built 2026-08 (`features/workspace/projects`, `features/workspace/tasks`). First real implementation of the sibling `hyrax-data-platform` repo's original "Module C: Project & Task Management Tracker" (`docs/hyrax-portal.md`) — that doc scoped it as "basic Kanban/list views, strictly time-boxed to avoid over-engineering," which shaped several of the scope cuts below (List-only view for v1, no per-project "Overview" tab, no drag-and-drop board). The day-one route/nav scaffolding (`WorkspaceRoutes.jsx`, the commented `WORKSPACE` nav segment, stub `Projects.jsx`/`Tasks.jsx` pages) predates this build by the whole life of the repo — it was never a design to preserve, just a slot to fill in.

## Why this shape, not something else

Every existing "assignment" relationship in this app before this module (`it_assets.asset_user_id`, `sales_leads.lead_owner_id`, `it_assets.asset_department_id`) is a single-owner FK column. `project_members`/`task_assignees` are **the first true many-to-many relationships in this schema** — a project needs multiple people, a task needs multiple people, and neither is expressible as one FK. Composite primary keys (`(project_id, employee_id)`, `(task_id, employee_id)`), not surrogate ids — these rows have no identity beyond the pairing.

Visibility (who can see a project/its tasks at all) and permission tier (what a visible member can *do*) are two separate axes, deliberately not conflated:

- **Visibility** — membership-gated (req #6): only `project_members` rows (any role) can see a project and all of its tasks. Not department-scoped — `supabase/access-control/README.md`'s own design rules already classify Workspace as R2, "no single department owns the data... unrestricted," so general access was always the intended shape, and this module doesn't introduce a department-based access model on top of that.
- **Permission tier** — a 4-value `project_members.role`: `owner` (exactly one, transferable, only tier that can delete the project), `lead` (zero or more, near-owner permissions), `member` (working member — assignable to tasks, can create tasks, can edit their own assigned tasks), `cc` (view-only supervisor/observer — "kind of like email CC" — sees everything, can't act on anything, never assignable to a task). Named `lead`, not `manager`: `roles_rows.csv` already has an unrelated, app-wide global role literally named `manager` (`profiles.role_id = 2`) — reusing that word for a project-local tier would be a real, confusing collision.

Department tags on a project (`project_departments` view) are informational/reporting metadata, not an access-control mechanism — derived live from each member's own `employees.department_id`, deliberately **not** `profiles.department_id` (the two can drift for one person who's transferred departments but whose profile hasn't been touched).

## Data model

| Table/View | Purpose |
| --- | --- |
| `project_categories` | Shared, user-extensible taxonomy (Internal/External/Plant Upgrade/Company Event/...). Anyone can add one on the fly via `get_or_create_project_category()`; only superadmin can rename/delete an existing one. |
| `projects` | Core entity. `status` (`PLANNING`/`ACTIVE`/`ON_HOLD`/`COMPLETED`/`CANCELLED`) is manual-only — never auto-flipped at 100% task progress, since a project can be fully task-complete and still waiting on sign-off. `created_by` is an immutable audit fact (who typed the create form), entirely separate from *ownership* (`project_members.role='owner'`), which is transferable. |
| `project_members` | Who can see/act on a project, and at what tier. A partial unique index (`... where role = 'owner'`) enforces exactly one owner per project as a hard DB invariant, not just app convention. |
| `tasks` | Linked to exactly one project. `status` (`TO_DO`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`) is one enum field, not a separate `is_cancelled` boolean — cancelled is mutually exclusive with the other three, so a boolean would risk invalid combinations. |
| `task_assignees` | Who's actually doing a task. Enforced (by trigger, not just RLS) to only ever contain employees who are already *working* members (owner/lead/member) of that task's project — never a `cc`. |
| `project_progress` / `projects_with_progress` (views) | Req #9's live-computed progress %: `completed / (total − cancelled)`, NULL (not 0) when there are zero non-cancelled tasks, so the UI shows "No tasks yet" instead of a misleading 0%. |
| `project_departments` (view) | Live-derived distinct set of departments a project's current members belong to. Not a stored/synced table — recomputed on every read, so it can never drift. |

Full DDL: `supabase/sql_editor/projects_tasks_schema_migration.sql`, `supabase/sql_editor/projects_tasks_views.sql`. RLS: `supabase/policies/{project_categories,projects,tasks,project_members,task_assignees}_crud.sql`. Everything else: `supabase/functions/` (one file per function) and `supabase/triggers/` (one file per `CREATE TRIGGER`).

## Three non-obvious pitfalls this design had to account for

**1. Plain Postgres views run with the view owner's privileges, not the querying session's.** `security_invoker = true` (Postgres 15+) is required on every one of the three views above — without it, a Supabase-Studio-created view (owned by a role that also owns the underlying tables, typically `BYPASSRLS`) would silently show every project's data to every authenticated user regardless of membership, a direct req #6 violation, even with fully correct RLS on `projects`/`tasks` themselves. It does **not** propagate through a chain of views — `projects_with_progress` is built on `project_progress`, so both carry the clause independently. (`employees_public_view.sql` has no such clause — plausibly fine there as an intentionally-open directory, but not a pattern this module could safely copy.)

**2. Project creation has a chicken-and-egg RLS problem.** A flat "any existing member can add another" `project_members` INSERT policy can't admit the very first member of a brand-new project — nobody is a member yet, including the creator, at the instant a project row is inserted. Resolved the same way `is_superadmin()` resolves the analogous `profiles`-recursion problem: `create_project()` is `SECURITY DEFINER`, doing its own explicit authorization inline rather than depending on policy wording (mirrors this repo's existing `link_profile_to_employee.sql` precedent exactly). A redundant `AFTER INSERT` trigger (`auto_add_project_creator_as_member`) also bootstraps the owner row directly, so the invariant holds regardless of insert path, not just through the one RPC.

**3. `project_members` cascades from `projects`, and `BEFORE DELETE` row triggers fire during a cascade exactly as they would for a direct delete.** The two member-removal guard triggers (`block_owner_removal_from_project_members`, `block_project_member_removal_with_active_tasks` — req #3/#5) both had to explicitly detect "is the whole project being torn down" (parent `projects` row already gone, since Postgres implements `ON DELETE CASCADE` as an `AFTER DELETE` trigger on the *parent* that fires once its own deletion is already applied) vs. "is this a standalone member removal." Without that check, deleting *any* project with real content (an owner, or a member with an in-flight task) would always be rejected by its own cascade — a severe, easy-to-miss regression that would only surface once someone tried to delete a non-trivial project.

## The permission-tier RLS, end to end

Five helper functions (`current_employee_id`, `is_project_member`, `is_working_project_member`, `is_elevated_project_member`, `is_project_owner`, plus `project_member_role` for checking an *arbitrary* employee's role rather than the caller's own) gate every policy. All are `SECURITY DEFINER language plpgsql` with `set search_path = ''` — required, not stylistic, wherever they're called from `project_members`' *own* policies: without it, evaluating that policy would re-query `project_members` to resolve the helper's `EXISTS` check, re-triggering the same policy forever (the same "infinite recursion detected in policy for relation" shape already documented for `profiles`/`is_superadmin()`).

| Action | Required tier |
| --- | --- |
| See a project / all its tasks | Any member (owner/lead/member/**cc**) |
| Create a task | Working member (owner/lead/member) |
| Edit a task's details/status | That task's own assignees only |
| Edit project details, manage membership, delete a task | Elevated (owner/lead) |
| Delete the project itself | Owner only |
| Transfer ownership | Owner only, via `transfer_project_ownership()` — the *only* path that can ever move the `owner` tag; the ordinary `project_members` UPDATE policy explicitly forbids touching a row where the old or new role is `'owner'` |
| Demote a working member (owner/lead/member) to `cc` | Blocked by trigger (`block_role_change_to_cc_with_active_tasks`) while they still hold any `TO_DO`/`IN_PROGRESS` task in that project — the same integrity rule `enforce_task_assignee_is_project_member` enforces on assignment, reached from the other direction (demotion after the fact, not assignment of an already-`cc` employee) |

`transfer_project_ownership()` demotes the old owner and promotes the new one as **two sequential `UPDATE` statements in a fixed order**, not one `UPDATE ... CASE`. A non-deferrable unique index (a partial index can never be made `DEFERRABLE`) is checked per row, in whatever order the executor visits the rows being updated — a single statement risks the executor processing the new owner's row before the old owner's, transiently creating two live owners and raising a non-deterministic duplicate-key error depending on UUID sort order. Two statements in a fixed order (demote, then promote) sidesteps this while staying atomic — both run inside the function's one implicit transaction.

**Client-side gating is superadmin-aware, not just membership-aware.** `useProjectPermissions.js` (the one hook every page in this module uses to hide/show elevated actions) initially derived `isOwner`/`isElevated`/`isWorkingMember` purely from the caller's own `project_members` row — but every RLS policy above already gives superadmin a full bypass regardless of membership, so a superadmin managing a project they didn't personally create saw every elevated action hidden client-side even though the database would have allowed all of them. Fixed by folding `useProfile()`'s `isSuperAdmin` into that one hook.

## Notifications

Plugs into the existing, already-shipped event-driven system (see `docs/NOTIFICATIONS-ARCHITECTURE.md`) — no new plumbing, just two new event types: `task.assigned` and `project.member_added`, both resolved via `target_payload_keys` (a single payload key naming exactly one `profiles.id` — a clean fit for "notify the one person this event is about"). Seeded for both `in_app` and `email` channels.

A `task.status_changed` event's natural audience — "everyone *currently* in this project's membership except whoever made the change" — doesn't fit today's targeting model: `target_payload_keys` resolves to one uuid, not a dynamic list. Extending `fan_out_notification_event()` to accept an array-valued payload key would be small and backward-compatible, but it's the shared engine every other module's notifications run through, so it's flagged here as a scoped follow-up rather than bundled into this module's migration.

## Frontend notes worth knowing before touching this code

- `col.show === false` hides a column from the **create/edit form**, not the table — the opposite of what this repo's own `CLAUDE.md` claims. The live convention for "keep in the form, hide from the table" is a manual `.filter(c => c.key !== "id")` the page does itself.
- `DataTable`'s inline cell-edit-and-save path is dead code (drops its `value` argument; nothing in this app uses it). Row-aware editability (a task is only editable by its own assignees) uses `column.render(displayValue, row)` instead, combined with `DataForm`/`DataSidebar`'s existing (previously unused) `cannotUpdate` prop to hide the Save button outright.
- `MultiSelectEditor` (new) and `ProjectCategoryEditor` (new, using `react-select/creatable` — bundled in the already-installed `react-select`) are the first multi-select and creatable-select editors in this codebase; both are registered in `src/components/dataTable/editors/Editors.jsx`.
- `projects_with_progress`/`project_progress` are views with no FK for PostgREST to embed through — `category:category_id(...)` and `project_members(...)` are resolved separately (a second query merged client-side, or a client-side lookup against an already-loaded list) rather than as a nested `.select()` embed against those views.
