-- Run this once in the Supabase SQL editor, AFTER leave_ledger_migration.sql
-- (hyrax-data-platform/infrastructure/) has been run, and after
-- supabase/functions/is_superadmin.sql / current_employee_id.sql exist.
--
-- leave_ledger_entries/leave_ledger_types were deliberately left without
-- RLS when first created (see leave_ledger_migration.sql's own comment) --
-- this is that follow-up, once a real self-service "My Leaves" page needed
-- row-level visibility rather than just the HR-only Leave Management page.
--
-- SAFE TO RE-RUN as of 2026-09-23 -- every policy is drop-if-exists +
-- create.
--
-- leave_ledger_ENTRIES is SELECT-only, and must stay that way: the only
-- writer is sync_leave_ledger_from_snapshot
-- (supabase/sql_editor/sync_leave_ledger_rpc.sql), a SECURITY DEFINER
-- function that bypasses RLS, same as every other write-path RPC here. HR2000
-- remains the system of record for leave, and a direct edit would just be
-- discarded by the next full-snapshot sync.
--
-- leave_ledger_TYPES is different, and gained HR write access on 2026-09-23.
-- It is not synced data -- it is the vocabulary the sync resolves against,
-- and it holds two fields HR2000 never supplies: `is_paid` and
-- `needs_hr_confirmation`. Editing a type is therefore NOT overwritten by the
-- next sync, unlike editing an entry.
--
-- The sync now auto-creates unknown codes rather than rejecting the whole
-- upload, defaulting them to PAID and flagging needs_hr_confirmation. Those
-- defaults are only safe if HR can review and correct them, which is what
-- these policies and the Leave Types tab exist for.
alter table public.leave_ledger_entries enable row level security;
alter table public.leave_ledger_types enable row level security;

-- leave_ledger_types is non-sensitive lookup data (just code/label/category)
-- needed to resolve labels for every tier below, including an employee
-- viewing their own leave -- open to any authenticated user rather than
-- tiered, since restricting it would silently null out the embedded
-- `leave_type` join on an otherwise-authorized leave_ledger_entries row.
drop policy if exists "Authenticated users can view leave types" on public.leave_ledger_types;
create policy "Authenticated users can view leave types" on public.leave_ledger_types
for select to authenticated
using (true);

-- WRITE access on leave_ledger_types -- HR and superadmin only (added
-- 2026-09-23 for the Leave Types tab).
--
-- INSERT so HR can add a code ahead of a sync that will use it. UPDATE so
-- they can classify what the sync auto-created -- above all `is_paid`, which
-- drives paidLeaveDaysTotal / unpaidLeaveDaysTotal in the payroll package and
-- is the one field an auto-created type gets wrong by default.
--
-- NO DELETE POLICY, deliberately. leave_ledger_entries.leave_type_id
-- references this table, so deleting a type in use would fail on the foreign
-- key anyway -- and deleting an UNUSED one is still wrong, because the next
-- sync would simply recreate it from the source file. `is_active = false` is
-- the retirement path and already exists.
drop policy if exists "HR can add leave types" on public.leave_ledger_types;
create policy "HR can add leave types" on public.leave_ledger_types
for insert to authenticated
with check (
    (select public.is_superadmin())
    or (select exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid()) and profiles.department_id = 7
    ))
);

drop policy if exists "HR can update leave types" on public.leave_ledger_types;
create policy "HR can update leave types" on public.leave_ledger_types
for update to authenticated
using (
    (select public.is_superadmin())
    or (select exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid()) and profiles.department_id = 7
    ))
)
with check (
    (select public.is_superadmin())
    or (select exists (
        select 1 from public.profiles
        where profiles.id = (select auth.uid()) and profiles.department_id = 7
    ))
);

-- Four permissive SELECT policies on leave_ledger_entries, OR'd together by
-- Postgres automatically -- a row is visible if ANY of them match.

-- Tier 1: self -- powers "My Leaves" (an employee's own leave history).
drop policy if exists "Employees can view own leave records" on public.leave_ledger_entries;
create policy "Employees can view own leave records" on public.leave_ledger_entries
for select to authenticated
using (
    employee_id = public.current_employee_id()
);

-- Tier 2: superadmin -- sees everything, no department/manager restriction.
drop policy if exists "Superadmin can view all leave records" on public.leave_ledger_entries;
create policy "Superadmin can view all leave records" on public.leave_ledger_entries
for select to authenticated
using (
    public.is_superadmin()
);

-- Tier 3: HR department -- sees everything (this is the table backing the
-- HR Leave Management page's full list).
drop policy if exists "HR can view all leave records" on public.leave_ledger_entries;
create policy "HR can view all leave records" on public.leave_ledger_entries
for select to authenticated
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid() and profiles.department_id = 7
    )
);

-- Tier 4: direct manager -- mirrors supabase/policies/manager_crud.sql's
-- attendance_activities pattern exactly (same "this employee's manager_id
-- points at me" shape), rewritten against current_employee_id() instead of
-- that file's inline repeated subquery. Direct reports only, not a
-- transitive hierarchy walk -- matches this app's existing manager-scoped
-- policies/authorization checks elsewhere (e.g. approve_attendance.sql).
drop policy if exists "Managers can view subordinates' leave records" on public.leave_ledger_entries;
create policy "Managers can view subordinates' leave records" on public.leave_ledger_entries
for select to authenticated
using (
    exists (
        select 1 from public.employees sub
        where sub.id = leave_ledger_entries.employee_id
          and sub.manager_id = public.current_employee_id()
    )
);
