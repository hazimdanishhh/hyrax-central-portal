-- Run once in the Supabase SQL editor. Foundation for the Employee Lifecycle
-- Checklist module (src/pages/user/employeeLifecycle/, src/features/
-- employeeLifecycle/) -- see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md.
--
-- BEFORE RUNNING THIS: verify employees.id / it_assets.asset_user_id are
-- really `uuid`, and that employment_status really has a `category` column
-- (both are load-bearing assumptions below, and this doc's own first draft
-- had the uuid one wrong):
--
--   select a.attname, format_type(a.atttypid, a.atttypmod)
--   from pg_attribute a join pg_class c on c.oid = a.attrelid
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relname in ('employees','it_assets')
--     and a.attname in ('id','asset_user_id') and a.attnum > 0 and not a.attisdropped;
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'employment_status';
--
-- If either check doesn't come back as expected, stop here and fix this
-- file before running it -- every uuid FK below depends on the first, and
-- the offboarding case-open trigger (a later file) depends on the second.

create type public.lifecycle_case_type as enum ('ONBOARDING', 'OFFBOARDING');
create type public.lifecycle_case_status as enum ('OPEN', 'COMPLETED', 'CANCELLED');
-- Four values, not five -- no separate BLOCKED. Whether an item is
-- meaningfully blocked on another is a fixed ordering fact already knowable
-- from its position in the fixed JS checklist config, not state that needs
-- its own row -- a "waiting on X" badge is a client-side computation, the
-- same "derive, don't duplicate" instinct applied everywhere else in this
-- module. SKIPPED covers both "not applicable to this employee" (seeded)
-- and "a human explicitly skipped it" -- same operational meaning (excluded
-- from what's required for case completion), so a fifth N/A value would be
-- redundant.
create type public.lifecycle_item_status as enum ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

create table public.employee_lifecycle_cases (
    id          uuid primary key default gen_random_uuid(),
    -- Anchored on employees, not profiles -- an onboarding case starts (HR
    -- creates the employee row) before a profiles row exists at all, per
    -- ONBOARDING-WORKFLOW-ARCHITECTURE.md's own step ordering. Every other
    -- assignment-style table in this schema (it_assets.asset_user_id,
    -- attendance_activities.employee_id) already anchors on employees for
    -- the same reason.
    employee_id uuid not null references public.employees(id),
    case_type   public.lifecycle_case_type not null,
    status      public.lifecycle_case_status not null default 'OPEN',
    opened_at   timestamptz not null default now(),
    -- Audit trail of which trigger condition actually fired, e.g.
    -- 'employee_row_inserted', 'resignation_date_set',
    -- 'status_terminated_notice', 'backfill_deploy_2026_09'.
    opened_reason text,
    -- Offboarding only in practice. Seeded from employees.resignation_date/
    -- end_date if present; HR-editable afterward via the case metadata
    -- sidebar. Lives on the case, not a new employees column, since it
    -- describes this specific separation event, not a standing employee fact.
    expected_last_day date,
    -- Case-level visibility gate, independent of any single item's own
    -- employee_visible flag (see employee_lifecycle_case_items below).
    -- Onboarding cases are created with this already true (nothing to hide
    -- from a new hire about their own onboarding); offboarding cases start
    -- false and HR flips it on once the employee has actually been told --
    -- an offboarding case can legitimately exist internally (starting IT's
    -- lead time) before that conversation has happened.
    employee_can_view boolean not null default false,
    closed_at   timestamptz,
    -- e.g. 'all_items_complete', 'resignation_retracted',
    -- 'offboarding_case_opened' (see the onboarding-auto-cancel design).
    closed_reason text,
    -- Shape-B cooldown dedup columns for the two offboarding scan
    -- notifications -- same convention as employees.confirmation_overdue_last_notified_at.
    it_revocation_reminder_last_notified_at timestamptz,
    overdue_last_notified_at timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.employee_lifecycle_cases is
    'One row per onboarding/offboarding attempt for one employee. See docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md.';

-- Hard invariant: at most one OPEN case of a given type per employee.
-- Mirrors project_members' own partial-unique-index "exactly one owner"
-- pattern. A rehire is assumed to produce a brand-new employees row (no
-- employment-history table exists to support multiple stints on one row),
-- so it naturally gets a fresh case via the same insert trigger -- no
-- case-reopening mechanism is needed or provided.
create unique index employee_lifecycle_cases_one_open_per_type_idx
    on public.employee_lifecycle_cases (employee_id, case_type)
    where status = 'OPEN';

create table public.employee_lifecycle_case_items (
    id         uuid primary key default gen_random_uuid(),
    case_id    uuid not null references public.employee_lifecycle_cases(id) on delete cascade,
    -- Matches a key 1:1 in src/data/onboardingChecklistMeta.js or
    -- offboardingChecklistMeta.js -- the JS file is the source of truth for
    -- label/applies-if/sort-order content; this table only stores per-case
    -- state.
    item_key   text not null,
    status     public.lifecycle_item_status not null default 'PENDING',
    completed_at timestamptz,
    completed_by uuid references public.profiles(id), -- null for system-derived completions
    notes      text,
    -- Stamped from the same fixed JS config at seed time. Required, not
    -- optional -- RLS enforces "only IT can write IT-owned items, only HR
    -- can write HR-owned items" against this column; null means "no
    -- department can write it" (e.g. role_department_assigned, superadmin-only).
    owning_department_sub text,
    -- Also stamped from the fixed config at seed time, and equally
    -- required as a persisted column, not JS-only: without a DB-side flag,
    -- an offboarding employee could read a sensitive item (e.g.
    -- credentials_rotated) directly via the REST API even though the
    -- frontend never renders it. Gates the employee's own select policy
    -- together with employee_lifecycle_cases.employee_can_view above.
    employee_visible boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (case_id, item_key)
);

comment on table public.employee_lifecycle_case_items is
    'One row per checklist item per case, seeded for EVERY fixed item (including non-applicable ones, as SKIPPED with a note) so HR/IT always see the full standard checklist. See docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md.';

-- Section B (IT asset assignment) design, referenced by this module's
-- it_asset_assigned / it_assets_returned derived items -- unrelated new
-- column, added here since this migration is the first thing to actually
-- need it. See ONBOARDING-WORKFLOW-ARCHITECTURE.md Section B.
alter table public.employees add column if not exists needs_it_asset boolean;

create index employee_lifecycle_cases_employee_id_idx on public.employee_lifecycle_cases (employee_id);
create index employee_lifecycle_cases_case_type_status_idx on public.employee_lifecycle_cases (case_type, status);
create index employee_lifecycle_case_items_case_id_idx on public.employee_lifecycle_case_items (case_id);

-- Enable only here -- actual policies live in supabase/policies/, deployed
-- last (see the RLS phase). Until then these two tables are RLS-enabled
-- with zero policies, meaning no one can read/write them at all, including
-- you testing in the app -- that's expected and safe, matching the
-- Projects & Tasks module's own precedent exactly.
alter table public.employee_lifecycle_cases enable row level security;
alter table public.employee_lifecycle_case_items enable row level security;
