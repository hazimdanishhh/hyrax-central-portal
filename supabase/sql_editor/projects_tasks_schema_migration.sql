-- Run once in the Supabase SQL editor. Foundation for the Projects & Tasks
-- module (src/pages/user/workspace/{projects,tasks}). This is the FIRST
-- true many-to-many junction pair in this schema -- every other
-- "assignment" elsewhere in this app (it_assets.asset_user_id,
-- sales_leads.lead_owner_id) is a single-owner FK column. Composite
-- primary keys on the junction tables, not surrogate ids, since those
-- rows have no identity beyond the (parent, employee) pair.
-- gen_random_uuid() needs no `create extension` line -- built into
-- Postgres core since v13.
--
-- BEFORE RUNNING THIS: verify employees.id is really `uuid` (multiply
-- corroborated across docs/shipped RPCs, but one file,
-- link_profile_to_employee.sql, implies bigint via a `p_employee_id
-- bigint` param -- likely stale, but confirm live):
--
--   select a.attname, format_type(a.atttypid, a.atttypmod)
--   from pg_attribute a join pg_class c on c.oid = a.attrelid
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relname = 'employees'
--     and a.attname in ('id','profile_id','department_id','manager_id')
--     and a.attnum > 0 and not a.attisdropped;

create type public.project_status as enum ('PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED');

-- One field, not a separate is_cancelled boolean -- CANCELLED is mutually
-- exclusive with the other three, so a boolean risks invalid combinations
-- (is_cancelled=true AND status=IN_PROGRESS).
create type public.task_status as enum ('TO_DO','IN_PROGRESS','COMPLETED','CANCELLED');

create table public.project_categories (
    id         bigserial primary key,
    name       text not null,
    created_by uuid references public.employees(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.project_categories is
    'User-created-on-the-fly taxonomy for projects (Internal/External/Plant Upgrade/Company Event/...). Shared, low-stakes -- anyone can add a new one, only superadmin can rename/delete.';

-- Case-insensitive uniqueness: users create these on the fly, so "Plant
-- Upgrade" and "plant upgrade" must not both exist. Targeted by
-- get_or_create_project_category()'s ON CONFLICT.
create unique index project_categories_name_lower_idx on public.project_categories (lower(btrim(name)));

create table public.projects (
    id              uuid primary key default gen_random_uuid(),
    name            text not null,
    description     text,
    status          public.project_status not null default 'PLANNING',
    category_id     bigint references public.project_categories(id) on delete set null,
    start_date      date,
    target_end_date date,
    -- Immutable audit fact ("who typed the create form"), never
    -- reassigned. Distinct from *ownership* (project_members.role =
    -- 'owner'), which IS transferable -- see transfer_project_ownership().
    -- RESTRICT (default, no ON DELETE clause) since this records who
    -- authored the project, not who it's about.
    created_by      uuid not null references public.employees(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint projects_name_not_blank check (btrim(name) <> ''),
    constraint projects_dates_sane check (
        target_end_date is null or start_date is null or target_end_date >= start_date
    )
);

comment on table public.projects is
    'Projects & Tasks module. Visibility is membership-gated via project_members (req #6). See docs/PROJECTS-TASKS-ARCHITECTURE.md.';

create table public.project_members (
    project_id  uuid not null references public.projects(id) on delete cascade,
    -- CASCADE: this row's entire reason to exist IS this employee's
    -- membership.
    employee_id uuid not null references public.employees(id) on delete cascade,
    -- Four-tier permission model (see docs/PROJECTS-TASKS-ARCHITECTURE.md):
    --   owner  - exactly one per project (partial unique index below),
    --            full control including project deletion and ownership
    --            transfer. Auto-assigned to the creator.
    --   lead   - zero or more, near-owner permissions (edit project,
    --            manage membership, create/delete tasks) except deleting
    --            the project or touching the 'owner' tag itself.
    --   member - working member: can be assigned tasks, create tasks,
    --            edit/update status+details of tasks assigned to them.
    --   cc     - view-only supervisor/observer ("kind of like email CC"):
    --            sees the project and all its tasks, same as everyone
    --            else, but is never assignable to a task and can't
    --            create/edit/delete anything.
    -- Named 'lead', not 'manager' -- roles_rows.csv already has an
    -- unrelated, app-wide global role literally named 'manager'
    -- (profiles.role_id = 2); reusing that word here would be a real,
    -- confusing collision.
    role        text not null default 'member' check (role in ('owner','lead','member','cc')),
    added_by    uuid references public.employees(id),
    added_at    timestamptz not null default now(),
    primary key (project_id, employee_id)
);

comment on table public.project_members is
    'Who can see/act on a project (req #6), and at what permission tier. Departments a project touches (project_departments view) are derived from employees.department_id here, not profiles.department_id -- the two can drift for one person.';

-- Exactly one owner per project, enforced as a hard DB invariant. Plain
-- partial UNIQUE INDEX (not a table CONSTRAINT -- only CREATE UNIQUE INDEX
-- supports a WHERE clause), which also means it can never be made
-- DEFERRABLE -- see transfer_project_ownership.sql's header comment for
-- why that shapes the ownership-transfer function's design.
create unique index project_members_single_owner_idx
    on public.project_members (project_id)
    where role = 'owner';

create table public.tasks (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects(id) on delete cascade,
    -- CASCADE kept as the schema-level backstop -- guard_project_deletion()
    -- is what actually makes hard-deleting a non-empty, non-cancelled
    -- project blocked in practice.
    title       text not null,
    description text,
    status      public.task_status not null default 'TO_DO',
    due_date    date,
    created_by  uuid not null references public.employees(id),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    constraint tasks_title_not_blank check (btrim(title) <> '')
);

comment on table public.tasks is
    'Linked to exactly one project (req #3). ALL project members (incl. cc) see ALL tasks (req #6) -- only task_assignees can update one.';

create table public.task_assignees (
    task_id     uuid not null references public.tasks(id) on delete cascade,
    employee_id uuid not null references public.employees(id) on delete cascade,
    assigned_by uuid references public.employees(id),
    assigned_at timestamptz not null default now(),
    primary key (task_id, employee_id)
);

comment on table public.task_assignees is
    'Req #4/#5. employee_id here MUST already be a project_members row for this task''s project, with a WORKING role (owner/lead/member, never cc) -- enforced by trigger, not just RLS.';

-- project_members(project_id) and task_assignees(task_id) are already
-- covered -- both are the LEADING column of their composite PK above, and
-- Postgres can use that alone for a single-column lookup.
create index projects_created_by_idx on public.projects (created_by);
create index projects_category_id_idx on public.projects (category_id);
create index project_members_employee_id_idx on public.project_members (employee_id);
create index tasks_project_id_idx on public.tasks (project_id);
-- Composite, not bare tasks(status): status alone is low-selectivity (4
-- values) and wouldn't serve "tasks in project X" any better than the
-- index above already does.
create index tasks_project_id_status_idx on public.tasks (project_id, status);
create index task_assignees_employee_id_idx on public.task_assignees (employee_id);

-- Enable only here -- actual policies live in supabase/policies/ (kept
-- separate, matching this repo's own kind-based folder convention).
alter table public.project_categories enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
