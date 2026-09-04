-- Run this once in the Supabase SQL editor, AFTER
-- hyrax-data-platform/infrastructure/item_groups_migration.sql has created
-- sap_item_groups (RLS is left disabled on it by that migration, same
-- convention as every other sap_* table).
--
-- sap_item_groups needs exactly the same read audience as sap_items itself
-- -- anyone resolving an item's group name needs both tables. Matches the
-- shape already live on sap_items (Sales Manager VIEW/Sales Staff VIEW) plus
-- this session's own additions (MGM Department VIEW via
-- mgm_sales_access_parity_fix.sql, Finance Department VIEW via
-- finance_department_access_fix.sql, Operations Department VIEW via
-- operations_department_access_fix.sql). Read-only everywhere -- nobody in
-- the app writes to any sap_* table, SAP is the system of record.
--
-- Idempotent: safe to re-run.

alter table public.sap_item_groups enable row level security;

drop policy if exists "Sales Department VIEW" on public.sap_item_groups;
create policy "Sales Department VIEW" on public.sap_item_groups
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'SAL'
  )
);

drop policy if exists "MGM Department VIEW" on public.sap_item_groups;
create policy "MGM Department VIEW" on public.sap_item_groups
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_item_groups;
create policy "Finance Department VIEW" on public.sap_item_groups
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Operations Department VIEW" on public.sap_item_groups;
create policy "Operations Department VIEW" on public.sap_item_groups
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);

drop policy if exists "Superadmin CRUD" on public.sap_item_groups;
create policy "Superadmin CRUD" on public.sap_item_groups
to authenticated
using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
) with check (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role_id = 3)
);
