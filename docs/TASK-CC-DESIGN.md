# Task CC — Design (not built yet)

**Status: designed, not implemented.** Nothing in this doc has been created in the database yet — no `task_ccs` table, no trigger, no RLS policy, no `notification_rules` row exists. This doc exists so the design doesn't need to be re-derived later. See `docs/PROJECTS-TASKS-ARCHITECTURE.md` for the module this extends, `docs/NOTIFICATIONS-ARCHITECTURE.md` for the generic event/rule/fan-out engine this plugs into, and `docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md` for how this fits into the module's full notification map.

## Why this shape, not something else

Task CC is a **notification-focus flag, not an access-control mechanism**. `docs/PROJECTS-TASKS-ARCHITECTURE.md`'s own RLS action table already settles visibility: "See a project / all its tasks → Any member (owner/lead/member/**cc**)." A project-level `cc` already sees every task in the project the moment they're a member — tagging them (or anyone else already visible) as task-CC changes nothing about what they can see or do. It only changes whether `notify_task_status_changed`/`notify_document_attached`/`task.comment_added` push a notification at them for *this specific task*. This is why task-CC is a pure junction/audience table, not a permission tier — it never needs a `role` column the way `project_members` does.

`task_ccs` (plural, matching `task_assignees`/`task_documents`) mirrors `task_assignees` as closely as possible on purpose: same composite PK shape, same audit-column shape, same trigger division of labor, same single-recipient notification shape. The two tables are conceptually siblings — "who's doing the work" vs. "who's watching the work."

**Column naming**: `assigned_by`/`assigned_at` and `added_by`/`added_at` are both `<past-tense-verb>_by`/`<past-tense-verb>_at`. Postgres identifiers can't contain an apostrophe, so "CC'd" becomes `ccd_by`/`ccd_at` — reads correctly out loud and slots into the same naming formula as its two siblings.

**Confirmed constraint**: a task-CC'd employee must already be an existing project member with a *working* tier (owner/lead/member — never a project-level `cc`, never a non-member). And must not overlap with that task's own assignees — a person is either assigned or CC'd to a given task, not both, enforced by trigger (hard rejection in both directions, not a silent auto-promote/auto-demote — no trigger anywhere in this codebase mutates a *different* table as a side effect of an insert into the one it's actually defined on, and the two-click alternative — unassign, then CC, or vice versa — isn't a real burden for what's meant to be a mutually-exclusive tag).

## Data model

```sql
create table public.task_ccs (
    task_id     uuid not null references public.tasks(id) on delete cascade,
    employee_id uuid not null references public.employees(id) on delete cascade,
    ccd_by      uuid references public.employees(id),
    ccd_at      timestamptz not null default now(),
    primary key (task_id, employee_id)
);

comment on table public.task_ccs is
    'Notification-focus flag, NOT an access-control mechanism -- a task-CC''d employee already has full read access to the task the moment they''re a project member (req #6). employee_id here MUST already be a WORKING (owner/lead/member, never cc) member of this task''s project, and MUST NOT already be one of this task''s own task_assignees -- both enforced by trigger, not just RLS.';

create index task_ccs_employee_id_idx on public.task_ccs (employee_id);

alter table public.task_ccs enable row level security;
```

No surrogate id — same rationale as `task_assignees`/`project_members`: this row has no identity beyond the `(task_id, employee_id)` pairing.

## RLS — mirrors `task_assignees_crud.sql`'s exact shape

| Policy | Tier | Notes |
| --- | --- | --- |
| Superadmin CRUD | `is_superadmin()` | Standard boilerplate. |
| SELECT | Any project member, any role (incl. `cc`) | Scoped by the task's project, identical to `task_assignees`' own SELECT policy. |
| INSERT | Caller: working member (owner/lead/member). Target `employee_id`: must also resolve to a working-member role. | `is_working_project_member(project_id) and project_member_role(project_id, employee_id) in ('owner','lead','member')` — the exact same tier and double-gate shape that governs assignment today. |
| DELETE (un-CC) | Working member (owner/lead/member) | Mirrors "Working members can unassign tasks" verbatim. |

No UPDATE policy — same as `task_assignees`: a CC row has nothing to edit, only add/remove.

## Integrity trigger(s)

**New: `enforce_task_cc_is_working_project_member()`**, mirroring `enforce_task_assignee_is_project_member.sql` structurally, fired `BEFORE INSERT OR UPDATE OF task_id, employee_id ON task_ccs` — rejects a target who isn't a project member at all, who is a project-level `cc` (already sees everything; task-level CC only applies to working members), or who is already assigned to the same task.

**Small addition to the already-shipped `enforce_task_assignee_is_project_member.sql`**: one new clause rejecting the reverse overlap — assigning someone who's currently CC'd on the same task, with a message pointing at removing the CC tag first.

**Why the overlap check lives in the trigger, not RLS**: same division of labor `task_assignees_crud.sql`/`enforce_task_assignee_is_project_member.sql` already use — RLS's INSERT policy gates the caller's own tier; the trigger gates the target row's integrity, fires regardless of RLS outcome, and gives a friendlier, specific error message.

## Notification events

Both single-recipient (`target_payload_keys`), same shape as `task.assigned` — no dynamic-loop engine work needed here.

**`task.cc_added`** — mirrors `notify_task_assigned.sql` exactly (`security definer set search_path=''`). `AFTER INSERT ON task_ccs`, skip self-cc (`new.ccd_by is not distinct from new.employee_id`), resolve the target's `profiles.id`, emit once with `cc_profile_id`.

**`task.cc_removed`** — mirrors `notify_task_unassigned.sql` exactly (built in the sibling notification-implementation pass, see `docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md`): `AFTER DELETE ON task_ccs`, actor read live via `current_employee_id()` (no `removed_by`/`ccd_by`-at-delete-time column exists), self-removal skipped by comparing to `old.employee_id`. **If `task.unassigned`'s shipped shape ever changes, update this to match** — the two are meant to stay twins.

Seed rule (`seed_task_cc_notification_rules.sql`, once built):
```sql
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('task.cc_added',   '{}'::jsonb, array['cc_profile_id'], array['in_app','email']),
  ('task.cc_removed', '{}'::jsonb, array['cc_profile_id'], array['in_app','email']);
```

## Documented follow-up: widening two already-implemented triggers

Once `task_ccs` exists, `notify_task_status_changed.sql` and `notify_document_attached.sql`'s recipient loops should `union` it in alongside `task_assignees` (both already resolve to `employees.profile_id`) — a small, additive change to each, not a redesign. Not part of this doc's own build.

## Frontend shape (describe, don't build)

No new editor component needed — `EmployeeMultiSelectEditor.jsx` (already registered as `employeeMultiSelect` in `Editors.jsx`, already used for `assignee_ids`) is the exact fit for a new `cc_ids` column in the same `tableConfig.jsx`, with its `options` filtered to exclude whichever employee ids are currently selected as `assignee_ids` in that same form instance.

New plumbing, each mirroring an existing sibling file exactly:
- `taskCcsMutations.js` — a `syncTaskCcs(taskId, employeeIds)` diff-and-sync function, same shape as `taskAssigneesMutations.js`'s `syncTaskAssignees`.
- `useTaskCcMutations.js` — mirrors `useTaskAssigneeMutations.js`.
- `ProjectTasksTab.jsx`'s add/edit handlers gain one more sync call (`cc_ids` alongside `assignee_ids`/`documents`).

## What's needed to actually build this later

- [ ] `task_ccs_schema_migration.sql` — table, index, RLS enable
- [ ] `enforce_task_cc_is_working_project_member.sql` + trigger
- [ ] One new clause in the already-shipped `enforce_task_assignee_is_project_member.sql`
- [ ] `task_ccs_crud.sql` (RLS policies)
- [ ] `notify_task_cc_added.sql` + trigger
- [ ] `notify_task_cc_removed.sql` + trigger — confirm it still matches `notify_task_unassigned.sql`'s shipped shape first
- [ ] `seed_task_cc_notification_rules.sql`
- [ ] `is_task_cc.sql` (new helper, mirrors `is_task_assignee.sql`) — also a dependency of Task Comments' INSERT policy
- [ ] Follow-up widening of `notify_task_status_changed.sql`/`notify_document_attached.sql`
- [ ] Frontend: `cc_ids` column, `taskCcsMutations.js`, `useTaskCcMutations.js`, wiring into `ProjectTasksTab.jsx`
- [ ] Update `docs/PROJECTS-TASKS-ARCHITECTURE.md` and `docs/NOTIFICATION-RULES-TRACKER.csv` once shipped
