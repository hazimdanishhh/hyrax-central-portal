-- Run this once in the Supabase SQL editor.
--
-- Context: a full live pg_policies audit (2026-09) found every existing MGM
-- grant across the Sales module uses one identical template -- "Management
-- VIEW" (profiles.role_id = 2 and profiles.department_id = 14, i.e.
-- manager-only, SELECT-only). That's correct for the genuinely
-- manager-gated pages (sales_targets, sales_budgets, employee_sales_rep_mapping
-- -- untouched by this file), but wrong for the tables backing the R3 pages
-- the 2026-09 route change deliberately made company-wide, no role
-- restriction, matching how SAL itself is ungated there (sales/leads,
-- sales/orders, sales/clients -- see supabase/access-control/README.md's
-- "Judgment calls" #2). A non-manager MGM staffer could already open those
-- pages, but the query came back empty.
--
-- Decisions made per-table with the user, not a blanket rule:
--   - sales_leads: full CRUD, department-wide (not self-scoped like Sales
--     Staff's own policy) -- matches the README's "MGM staff personally work
--     Leads day-to-day" rationale.
--   - sales_leads_stage_history: read-only regardless -- an audit trail
--     isn't something Top Management hand-edits even though Sales itself can.
--   - clients: full CRUD, department-wide -- same parity as sales_leads.
--   - sap_customers / sap_items / sap_sales_persons / sap_sales_orders /
--     sap_sales_order_lines / sap_deliveries / sap_delivery_lines: read-only
--     only -- Sales itself only has SELECT ("Sales Manager VIEW"/"Sales
--     Staff VIEW") on these SAP-mirrored tables (SAP is the system of
--     record), so MGM can't get more than Sales already has.
--
-- Style note: uses profiles/departments joined by departments.sub (readable),
-- not the hardcoded numeric department_id/role_id the live "Management VIEW"
-- policies use -- matching sales_targets_budgets_crud.sql's newer convention,
-- not the older numeric-id style still live everywhere else. No roles join
-- is needed below (unlike that file) since every policy here is
-- department-wide, not manager-restricted.
--
-- Idempotent: each block drops the old manager-only policy by name before
-- creating its replacement, so this is safe to re-run.

-- === sales_leads: full CRUD, department-wide ===
drop policy if exists "Management VIEW" on public.sales_leads;

create policy "MGM Department CRUD" on public.sales_leads
to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
) with check (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

-- === sales_leads_stage_history: read-only, department-wide ===
drop policy if exists "Management VIEW" on public.sales_leads_stage_history;

create policy "MGM Department VIEW" on public.sales_leads_stage_history
for select
to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

-- === clients: full CRUD, department-wide (no prior MGM policy existed --
-- clients only worked for MGM by accident, via the blanket "Enable read
-- access for all users" policy already on this table, which is untouched
-- here and left as its own separate, unresolved over-exposure question) ===
create policy "MGM Department CRUD" on public.clients
to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
) with check (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

-- === SAP-mirrored tables: read-only, department-wide (matches Sales' own
-- view-only rights on these -- SAP is the system of record, nobody in the
-- app writes to them) ===
drop policy if exists "Management VIEW" on public.sap_customers;
create policy "MGM Department VIEW" on public.sap_customers
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_items;
create policy "MGM Department VIEW" on public.sap_items
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_sales_persons;
create policy "MGM Department VIEW" on public.sap_sales_persons
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_sales_orders;
create policy "MGM Department VIEW" on public.sap_sales_orders
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_sales_order_lines;
create policy "MGM Department VIEW" on public.sap_sales_order_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_deliveries;
create policy "MGM Department VIEW" on public.sap_deliveries
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_delivery_lines;
create policy "MGM Department VIEW" on public.sap_delivery_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);
