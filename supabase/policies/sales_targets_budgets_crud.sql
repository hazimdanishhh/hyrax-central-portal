-- Run this once in the Supabase SQL editor.
--
-- Neither sales_targets nor sales_budgets has any RLS policy today. Access
-- here is role/department-based (a Sales manager sets quotas for the team),
-- not per-row like manager_crud.sql's "this employee's manager" pattern --
-- that shape doesn't fit a table with no owning-manager column of its own.
-- Mirrors ProfileContext's role/department shape: profiles.role_id ->
-- roles.name, profiles.department_id -> departments.sub.
--
-- Verify before relying on this: confirm RLS is actually enabled on both
-- tables (uncomment the ENABLE lines below if not already on), and that no
-- broader existing policy already covers them.
--
-- 2026-09: MGM managers now get the same access as SAL managers here (Sales
-- module access-parity change). If these policies were already deployed with
-- the old SAL-only clause, `create policy` won't update them in place -- drop
-- the 4 existing policies first, then re-run this whole file.

-- alter table public.sales_targets enable row level security;
-- alter table public.sales_budgets enable row level security;

create policy "Sales Manager CRUD" on public.sales_targets
to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub in ('SAL', 'MGM')
  )
) with check (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub in ('SAL', 'MGM')
  )
);

create policy "Superadmin CRUD" on public.sales_targets
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);

create policy "Sales Manager CRUD" on public.sales_budgets
to authenticated
using (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub in ('SAL', 'MGM')
  )
) with check (
  exists (
    select 1 from profiles p
    join roles r on r.id = p.role_id
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and r.name = 'manager' and d.sub in ('SAL', 'MGM')
  )
);

create policy "Superadmin CRUD" on public.sales_budgets
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);
