# Task Comments — Design (not built yet)

**Status: designed, not implemented.** Nothing in this doc has been created in the database yet — no `task_comments` table, no policy, no trigger, no `notification_rules` row exists. See `docs/PROJECTS-TASKS-ARCHITECTURE.md`, `docs/NOTIFICATIONS-ARCHITECTURE.md`, `docs/TASK-CC-DESIGN.md` (this feature depends on it), and `docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md`.

## Why this shape, not something else

**Table id: `bigint generated always as identity`, not `uuid`.** Every other Workspace entity table uses a `uuid` surrogate key, but the closest real precedent for this table's nature is `notification_events` (`emit_notification_event()` returns `bigint`) — both are high-cardinality, append-heavy, chronologically-ordered rows never referenced by a URL or another table's FK the way `projects.id`/`tasks.id` are.

**Hard delete, not soft delete.** No soft-delete pattern (`deleted_at`) exists anywhere in this schema today — adding one here would introduce a new pattern every future query against this table has to remember to filter, forever. The DELETE tier is explicitly modeled on `documents`' own tiering ("uploader or elevated member") — and `documents` itself is hard-deleted, unaudited, explicitly called a "warn and allow" behavior. Giving `task_comments` the identical delete tier but a *stricter* deletion mechanism than its own precedent would be an inconsistency, not a safety improvement. This also matches the module's own stated principle in `docs/PROJECTS-TASKS-ARCHITECTURE.md`'s "Lifecycle dates" section: build the simple current-state answer now, add history/audit machinery later only if a real need shows up.

**Plain `UPDATE` for edits, not immutable-remove-and-repost.** The opposite reasoning from `documents`: a comment's `body` is exactly the kind of single mutable field `tasks`/`projects` already model with plain columns — a typo fix is a genuine in-place edit, not a new thing replacing an old one.

**`updated_at` nullable-until-edited**, reusing the existing generic `set_updated_at()` trigger (already wired to `tasks`/`projects`/`sales_leads`/two HR tables) unchanged — declared with no default, so it stays `null` until the first genuine edit, giving the UI a clean "(edited)" signal for free.

## Data model

```sql
create table public.task_comments (
    id                 bigint generated always as identity primary key,
    task_id            uuid not null references public.tasks(id) on delete cascade,
    author_employee_id uuid not null references public.employees(id),
    body               text not null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz,
    constraint task_comments_body_not_blank check (btrim(body) <> '')
);

comment on table public.task_comments is
    'Lightweight per-task comment thread. Visibility mirrors the task itself (req #6: any project member, any role, can read). Hard-deleted on removal -- same tier and unaudited-delete posture as documents, not a new soft-delete pattern.';

create index task_comments_task_id_created_at_idx on public.task_comments (task_id, created_at);
create index task_comments_author_employee_id_idx on public.task_comments (author_employee_id);

alter table public.task_comments enable row level security;

create trigger trg_set_task_comments_updated_at
before update on public.task_comments
for each row execute function public.set_updated_at();
```

`author_employee_id` has no `on delete cascade`/`set null` — immutable audit fact, same convention as `tasks.created_by`/`documents.attached_by`.

## RLS

| Policy | Tier | Notes |
| --- | --- | --- |
| Superadmin CRUD | `is_superadmin()` | Standard boilerplate. |
| SELECT | Any project member, any role (incl. `cc`) | Comments aren't more sensitive than the task they're on. |
| INSERT | Task assignees + task-CC'd (once Task CC ships) + owner/lead | Requires `author_employee_id = current_employee_id()` — same self-attribution requirement `documents`' INSERT policy uses. |
| UPDATE | Author only, own comment | `author_employee_id = current_employee_id()` on both `using` and `with check`. |
| DELETE | Author (self-service) OR owner/lead (moderation) | Exact same tiering `documents_crud.sql` already uses for its own DELETE policy. |

INSERT policy (final intended shape, once Task CC has shipped):
```sql
create policy "Assignees, CCs, and elevated members can comment on tasks" on public.task_comments
for insert to authenticated
with check (
    author_employee_id = public.current_employee_id()
    and (
        public.is_task_assignee(task_id)
        or public.is_task_cc(task_id)
        or public.is_elevated_project_member((select project_id from public.tasks where id = task_id))
    )
);
```

`is_task_assignee(task_id)` already exists and is reused as-is. `is_task_cc(task_id)` is a new helper (see `docs/TASK-CC-DESIGN.md`), mirroring `is_task_assignee.sql`'s exact structure.

**Cross-feature dependency**: if Task Comments ships before Task CC, deploy the INSERT policy without the `is_task_cc(task_id)` clause (assignees + elevated members only), then add it back via `alter policy` once `task_ccs`/`is_task_cc()` land — a one-line follow-up, not a redesign, since omitting a not-yet-existing population is strictly narrower, never a violation of the "at least as permissive as the existing RLS action table" floor.

**No integrity trigger needed** — unlike `task_assignees`/`task_ccs`, `author_employee_id` is never an arbitrary target; the INSERT policy already pins it to the caller themselves.

## Notification event: `task.comment_added`

A dynamic multi-recipient event, same shape as `notify_task_status_changed.sql`/`notify_document_attached.sql`: `AFTER INSERT` trigger, loop distinct `profile_id`s from a `union` of three recipient-resolving subqueries (assignees, task-CCs, project owner/lead), one `emit_notification_event()` call per recipient, excluding the comment's own author.

```sql
create or replace function public.notify_task_comment_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_task_title text;
    v_project_id uuid;
    v_recipient record;
begin
    select t.title, t.project_id into v_task_title, v_project_id
    from public.tasks t where t.id = new.task_id;

    for v_recipient in
        select distinct e.profile_id
        from (
            select ta.employee_id from public.task_assignees ta where ta.task_id = new.task_id
            union
            select tc.employee_id from public.task_ccs tc where tc.task_id = new.task_id
            union
            select pm.employee_id from public.project_members pm
                where pm.project_id = v_project_id and pm.role in ('owner', 'lead')
        ) recipients(employee_id)
        join public.employees e on e.id = recipients.employee_id
        where recipients.employee_id is distinct from new.author_employee_id
          and e.profile_id is not null
    loop
        begin
            perform public.emit_notification_event(
                'task.comment_added', 'task_comments', new.id::text,
                jsonb_build_object(
                    'task_id', new.task_id,
                    'project_id', v_project_id,
                    'comment_id', new.id,
                    'author_employee_id', new.author_employee_id,
                    'recipient_profile_id', v_recipient.profile_id,
                    'title', 'New Comment on Task',
                    'message', format('New comment on "%s".', coalesce(v_task_title, 'a task')),
                    'link_to', '/app/workspace/tasks/' || new.task_id
                )
            );
        exception when others then
            raise warning 'task.comment_added notification failed for comment % recipient %: %',
                new.id, v_recipient.profile_id, sqlerrm;
        end;
    end loop;

    return new;
end;
$$;
```

Until Task CC ships, the `task_ccs` subquery is a harmless empty-set union — no error, just no CC recipients yet.

Seed rule (`seed_task_comment_notification_rules.sql`, once built):
```sql
insert into public.notification_rules (event_type, condition, target_payload_keys, channels) values
  ('task.comment_added', '{}'::jsonb, array['recipient_profile_id'], array['in_app','email']);
```

**Should editing or deleting a comment also notify? No.** Only new comments notify — an edit is typically a typo/clarity fix on content the audience has already been told about once, and re-notifying on every edit would be pure noise. A delete has no natural "somebody needs to know" story either (unlike `document.removed`, which protects the original uploader from being blindsided by someone *else's* deletion — a different concern not asked for here).

**Future extension, explicitly not designed now**: `@mentions` inside comment text, parsing `body` for direct references and notifying them. Noted only so it isn't forgotten.

## Frontend shape (describe, don't build)

There is no separate task detail page today — `WorkspaceRoutes.jsx`'s `tasks/:taskId` route renders `null`; both `ProjectTasksTab.jsx` and `MyTasks.jsx` show task detail as a slide-in `DataSidebar`. `DataSidebar.jsx` already accepts an unused `children` prop rendered after `DataForm` — the natural, zero-change extension point for a `<TaskCommentsThread taskId={...} />` in both places.

At a high level, `TaskCommentsThread` needs: a list query hook (`useTaskComments(taskId)`, mirrors `useTasksByProject.js`'s shape, ordered by `created_at`, joined to `employees` for author name), a mutation hook (`useTaskCommentMutations(taskId)`, mirrors `useTaskMutations.js`'s create/update/delete + toast + invalidate shape), a rendered list (author, timestamp, body, "(edited)" tag when `updated_at is not null`) with edit/delete gated client-side by authorship or elevation (UX only — RLS is the real boundary), and a plain textarea + submit enabled for assignees/CC/elevated members.

## What's needed to actually build this later

- [ ] `task_comments_schema_migration.sql` — table, indexes, RLS enable, `trg_set_task_comments_updated_at`
- [ ] `task_comments_crud.sql`
- [ ] `is_task_cc.sql` — shared dependency with Task CC; ship the INSERT policy without its clause if this lands first
- [ ] `notify_task_comment_added.sql` + trigger
- [ ] `seed_task_comment_notification_rules.sql`
- [ ] Frontend: `useTaskComments.js`, `useTaskCommentMutations.js`, `taskCommentsService.js`/`taskCommentMutations.js`, `TaskCommentsThread.jsx` wired into both `ProjectTasksTab.jsx` and `MyTasks.jsx` via `DataSidebar`'s `children`
- [ ] Update `docs/PROJECTS-TASKS-ARCHITECTURE.md` and `docs/NOTIFICATION-RULES-TRACKER.csv` once shipped
