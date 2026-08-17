# Projects & Tasks Module — Deployment Guide

Exact, ordered steps to deploy the schema, security, and notification wiring described in [`docs/PROJECTS-TASKS-ARCHITECTURE.md`](../PROJECTS-TASKS-ARCHITECTURE.md). Follow in order — later steps genuinely depend on earlier ones (helper functions before the policies that call them, tables before the triggers that reference them, etc.).

Everything below runs in the **Supabase Studio SQL editor** (Project → SQL Editor → New query). Unlike a couple of older functions in this repo (e.g. `log_sales_leads_stage_change.sql`), **every file below is a complete, self-contained `create or replace function/table/view/policy/trigger ...` statement** — open the file, copy the whole thing, paste into the SQL editor, run. No wrapping or editing needed anywhere in this guide.

The frontend (`src/features/workspace/`, `src/pages/user/workspace/`, routes, nav) is already built and requires no separate deployment beyond your normal `npm run build`/deploy — it's inert until the SQL below exists, so do the SQL first.

---

## 0. Prerequisite — verify `employees.id` is really `uuid`

Every foreign key in this module assumes `employees.id` is `uuid`. This is multiply corroborated (shipped RPCs, docs) but one file in this repo (`link_profile_to_employee.sql`) implies `bigint` via a stale parameter type — confirm live before proceeding.

- [ ] Run:

```sql
select a.attname, format_type(a.atttypid, a.atttypmod)
from pg_attribute a join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'employees'
  and a.attname in ('id','profile_id','department_id','manager_id') and a.attnum > 0 and not a.attisdropped;
```

- [ ] Confirm `id` comes back `uuid`. **If it doesn't, stop here** — every table/function below needs its `uuid` FK columns changed to match before you run anything else.

---

## 1. Schema — tables, types, indexes

- [ ] Run **`supabase/sql_editor/projects_tasks_schema_migration.sql`**

Creates `project_status`/`task_status` enums, `project_categories`/`projects`/`project_members`/`tasks`/`task_assignees` tables (with the partial unique index enforcing exactly one `owner` per project), all indexes, and enables RLS on all five tables (policies come later in step 9 — until then these tables are RLS-enabled with zero policies, meaning **no one** can read/write them, including you testing in the app — that's expected and safe).

- [ ] Run **`supabase/sql_editor/seed_project_categories.sql`**

Seeds "Internal Project" / "External / Client Project" / "Plant Upgrade" / "Company Event" so the category picker isn't empty on day one.

## 2. Replace `set_updated_at`

- [ ] Run **`supabase/functions/set_updated_at.sql`**

This repo's existing copy of this file only ever captured the trigger _body_, not a full function definition (a documented, pre-existing gap) — this replaces it with the complete, idempotent version. Safe even if a function with this exact body is already live under this name.

## 3. Helper functions (recursion-safe permission checks)

Order doesn't matter within this group — Postgres doesn't validate a plpgsql function body against other objects until the function is actually _called_. All must exist before step 9's policies.

- [ ] `supabase/functions/current_employee_id.sql`
- [ ] `supabase/functions/is_project_member.sql`
- [ ] `supabase/functions/is_working_project_member.sql`
- [ ] `supabase/functions/is_elevated_project_member.sql`
- [ ] `supabase/functions/is_project_owner.sql`
- [ ] `supabase/functions/project_member_role.sql`
- [ ] `supabase/functions/is_task_assignee.sql`

## 4. Integrity & guard trigger functions

- [ ] `supabase/functions/enforce_task_assignee_is_project_member.sql` — req #5: rejects assigning a non-member, or a `cc`, to a task.
- [ ] `supabase/functions/auto_add_project_creator_as_member.sql` — guarantees the creator always lands as `owner`.
- [ ] `supabase/functions/guard_project_deletion.sql` — blocks deleting a project that still has tasks, unless it's already `CANCELLED`.
- [ ] `supabase/functions/block_owner_removal_from_project_members.sql` — req #5: owner can't be removed without transferring ownership first. Correctly no-ops during a whole-project delete cascade — see its header comment if you ever need to touch this.
- [ ] `supabase/functions/block_project_member_removal_with_active_tasks.sql` — req #3: a member can't be removed while they still hold `TO_DO`/`IN_PROGRESS` tasks in that project.

## 5. RPC functions

- [ ] `supabase/functions/create_project.sql` — atomic project + initial owner/leads/members/ccs in one call. The frontend's "Add Project" form calls this, not a plain insert.
- [ ] `supabase/functions/transfer_project_ownership.sql` — the only path that can ever move the `owner` tag.
- [ ] `supabase/functions/get_or_create_project_category.sql` — backs the "create new category on the fly" picker.

## 6. Notification trigger functions

Plugs into the existing notification system ([`docs/NOTIFICATIONS-ARCHITECTURE.md`](../NOTIFICATIONS-ARCHITECTURE.md)) — requires that system already deployed ([`NOTIFICATIONS-DEPLOYMENT-GUIDE.md`](./NOTIFICATIONS-DEPLOYMENT-GUIDE.md)). If you haven't deployed that yet, do it first — `emit_notification_event()` must already exist.

- [ ] `supabase/functions/notify_task_assigned.sql`
- [ ] `supabase/functions/notify_project_member_added.sql`

## 7. Wire up every trigger

Run each of these 9 files — all `create trigger`/`create or replace trigger`, safe to run even if the trigger already exists:

- [ ] `supabase/triggers/trg_set_projects_updated_at.sql`
- [ ] `supabase/triggers/trg_set_tasks_updated_at.sql`
- [ ] `supabase/triggers/trg_enforce_task_assignee_is_project_member.sql`
- [ ] `supabase/triggers/trg_auto_add_project_creator_as_member.sql`
- [ ] `supabase/triggers/trg_guard_project_deletion.sql`
- [ ] `supabase/triggers/trg_block_owner_removal_from_project_members.sql` — **run this one before the next** (its name sorts first alphabetically, which is also the intended firing order: if a row is both the owner and holds active tasks, the "transfer ownership first" message should win over the "still has active tasks" one).
- [ ] `supabase/triggers/trg_block_project_member_removal_with_active_tasks.sql`
- [ ] `supabase/triggers/trg_notify_task_assigned.sql`
- [ ] `supabase/triggers/trg_notify_project_member_added.sql`

## 8. Views

- [ ] Run **`supabase/sql_editor/projects_tasks_views.sql`**

Creates `project_progress`, `projects_with_progress`, `project_departments` — all three explicitly `WITH (security_invoker = true)`. **Do not remove that clause if you ever edit these views** — without it, every project's data would be readable by every authenticated user regardless of membership (see the architecture doc's pitfall #1).

## 9. RLS policies

**Checkpoint before this step**: the tables have been RLS-enabled with zero policies since step 1 — nothing works in the app yet. After this step, the module is live.

- [ ] `supabase/policies/project_categories_crud.sql`
- [ ] `supabase/policies/projects_crud.sql`
- [ ] `supabase/policies/tasks_crud.sql`
- [ ] `supabase/policies/project_members_crud.sql`
- [ ] `supabase/policies/task_assignees_crud.sql`

## 10. Seed the notification rules

- [ ] Run **`supabase/sql_editor/seed_projects_tasks_notification_rules.sql`**

Seeds `task.assigned` and `project.member_added`, both `in_app` + `email` channels (per the confirmed decision). No `task.status_changed` rule is seeded — see the architecture doc's Notifications section for why (a real, currently-unresolved limitation in the shared notification-targeting engine, not an oversight here).

---

## 11. Post-launch addition — role-change-to-CC guard

**If you've already run steps 0–10 above, this is the only new SQL to run** — a real integrity gap found after launch: `enforce_task_assignee_is_project_member.sql` (step 4) already blocks _assigning_ a `cc` to a task, but nothing stopped _demoting_ an existing working member to `cc` while they still held active tasks in that project, which would leave those `task_assignees` rows pointing at an employee no longer eligible to hold them.

- [ ] `supabase/functions/block_role_change_to_cc_with_active_tasks.sql`
- [ ] `supabase/triggers/trg_block_role_change_to_cc_with_active_tasks.sql`

No RLS policy changes — this is an integrity trigger, the same layer as the two existing member-removal guards, not a permission check.

---

## Frontend

Nothing to deploy specially — `src/routes/WorkspaceRoutes.jsx` and `src/data/sideNavLinkData.js` are already updated and shipped with the rest of the app's normal build/deploy. Confirm after your next deploy (or `npm run dev` locally) that **Projects** and **Tasks** appear as a new **WORKSPACE** section in the sidebar.

---

## Verifying it all worked

Do this as a real (non-superadmin) test user with a linked `employees` row, logged into the app:

- [ ] **Create a project** via "Add Project" — pick an initial Lead, Member, and CC each in the create form. Confirm it appears in the Projects list immediately afterward with `PLANNING` status and "No tasks yet" progress.
- [ ] Open the project. Confirm the header shows name/status/category/progress, and "Edit Project"/"Transfer Ownership"/"Delete Project" are all visible (you're the owner).
- [ ] Go to the **Members** tab — confirm all four people (you as Owner, plus your chosen Lead/Member/CC) are listed with the right role badges.
- [ ] Go to the **Tasks** tab, **Add Task**, assign it to the Member you added. Confirm the task-assignee picker only offers project members — never the whole company directory.
- [ ] Log in as that assigned Member — confirm the task shows up on their **My Tasks** page (`/app/workspace/tasks`), and they got an in-app (and, once your email dispatcher is deployed, email) notification.
- [ ] As a project member who is **not** the task's assignee, open that task — confirm every field renders but there's no way to save changes.
- [ ] Log in as the CC'd person — confirm they can see the project and every task in it, but there's no "Add Task" button and they're never offered as a task-assignee option anywhere.
- [ ] Log in as a **different** employee who isn't on this project at all — confirm the project doesn't appear in their list, and navigating directly to its URL shows "Project not found."
- [ ] Back as the owner: try **Transfer Ownership** to the Lead. Confirm the Lead now has the owner's controls and you don't.
- [ ] As the new owner, try **removing the original owner** (now a plain Lead) from the project while they still hold an incomplete task — confirm it's blocked with a message naming the task. Mark that task Completed (or Cancelled), then retry the removal — confirm it now succeeds.
- [ ] Mark every remaining task in the project `COMPLETED` — confirm the progress bar reaches 100% and the project's own status does **not** auto-change (it stays whatever it was — completion is a manual call).
- [ ] Cancel one task — confirm it drops out of both the numerator and denominator of the progress %.
- [ ] In "Add Project" or "Add Members", type a brand-new category/check the category picker: type a name that doesn't exist and confirm it's created and immediately selectable; try the same name again with different capitalization and confirm it reuses the existing category rather than creating a duplicate.
- [ ] Try deleting a project that still has tasks — confirm it's blocked. Cancel the project, then delete it — confirm it now succeeds, including when the project has multiple members with different roles (this exercises the cascade-guard fix in the two member-removal triggers — see the architecture doc's pitfall #3 if this ever fails unexpectedly).
