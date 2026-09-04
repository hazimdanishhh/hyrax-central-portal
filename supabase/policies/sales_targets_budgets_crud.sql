-- Run this once in the Supabase SQL editor.
--
-- Full rewrite (2026-09) of every live policy on sales_targets and
-- sales_budgets, built directly from docs/TABLE-POLICIES.csv (the live
-- pg_policies ground truth), not from guessing at intent. Every policy
-- below is scoped so its NAME states exactly its audience and access level
-- -- no policy grants more than its name implies, and no two policies on
-- the same table overlap in scope without one being a documented,
-- deliberate subset. This replaces the previous version of this file, which
-- folded MGM into a policy still named "Sales Manager CRUD" -- accurate in
-- effect, confusing to read, and exactly the kind of drift this rewrite
-- removes.
--
-- Mirrors ProfileContext's role/department shape: profiles.role_id ->
-- roles.name, profiles.department_id -> departments.sub. RLS is already
-- confirmed enabled on both tables live -- no ENABLE statement needed here.
--
-- Idempotent: every currently-live policy on both tables (per the CSV) is
-- dropped by its exact live name before its replacement is created, so this
-- is safe to re-run and leaves no stale/duplicate policy behind.
--
-- === sales_targets: live policies were "Management VIEW" (MGM manager,
-- view-only), "Sales Manager CRUD" (SAL manager, full CRUD), "Sales Staff
-- self CRUD" (SAL staff, self-scoped full CRUD via lead_owner_id),
-- "Superadmin CRUD". Target state: same 4 audiences, MGM upgraded from
-- view-only to full CRUD (matching the Sales Manager CRUD it now mirrors),
-- each in its own single-audience policy. ===

drop policy if exists "Management VIEW" on public.sales_targets;
drop policy if exists "Sales Manager CRUD" on public.sales_targets;
drop policy if exists "Sales Staff self CRUD" on public.sales_targets;
drop policy if exists "Superadmin CRUD" on public.sales_targets;

create policy "Sales Manager CRUD" on public.sales_targets
to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'SAL'
  )
) with check (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'SAL'
  )
);

create policy "MGM Manager CRUD" on public.sales_targets
to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'MGM'
  )
) with check (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'MGM'
  )
);

create policy "Sales Staff Self CRUD" on public.sales_targets
to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'staff' and d.sub = 'SAL'
  )
  and lead_owner_id = (select employees.id from employees where employees.profile_id = auth.uid())
) with check (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'staff' and d.sub = 'SAL'
  )
  and lead_owner_id = (select employees.id from employees where employees.profile_id = auth.uid())
);

create policy "Superadmin CRUD" on public.sales_targets
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);

-- === sales_budgets: live policies were "Management VIEW" (MGM manager,
-- view-only), "Sales Department VIEW" (any SAL role, view-only),
-- "Sales Manager VIEW" (SAL manager, view-only -- a strict subset of
-- "Sales Department VIEW", dropped below and not recreated), "Superadmin
-- CRUD". No Sales-Manager write policy existed at all -- confirmed bug,
-- Sales managers couldn't save a budget edit despite the UI's Budgets tab
-- assuming they could. Target state: MGM upgraded to full CRUD (matching
-- sales_targets), Sales Manager gets a real write policy for the first
-- time, Sales Department VIEW stays as the only way non-manager Sales staff
-- can view it (no staff write policy exists here, unlike sales_targets --
-- budgets are a manager-only edit surface by design, per OrdersPageLayout's
-- Budgets tab being manager-gated with no staff-facing edit UI). ===

drop policy if exists "Management VIEW" on public.sales_budgets;
drop policy if exists "Sales Department VIEW" on public.sales_budgets;
drop policy if exists "Sales Manager VIEW" on public.sales_budgets;
drop policy if exists "Superadmin CRUD" on public.sales_budgets;

create policy "Sales Manager CRUD" on public.sales_budgets
to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'SAL'
  )
) with check (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'SAL'
  )
);

create policy "MGM Manager CRUD" on public.sales_budgets
to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'MGM'
  )
) with check (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub = 'MGM'
  )
);

create policy "Sales Department VIEW" on public.sales_budgets
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'SAL'
  )
);

create policy "Superadmin CRUD" on public.sales_budgets
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);
