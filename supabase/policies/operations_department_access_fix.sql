-- Run this once in the Supabase SQL editor.
--
-- Confirmed live via a full pg_policies audit (2026-09): Operations
-- (department sub 'OPS', id 9) has NO policy anywhere in the database --
-- same gap as Finance (see finance_department_access_fix.sql), independently
-- confirmed.
--
-- Impact: OperationsRoutes.jsx gates Operations Reports to
-- departments=["OPS","MGM"] roles=["manager"]. fetchOperationsDashboard.js
-- calls the get_operations_dashboard RPC, whose CTEs read sap_sales_orders,
-- sap_sales_order_lines, sap_deliveries, sap_delivery_lines, sap_invoices,
-- sap_invoice_lines, and sap_items directly -- none of which grant
-- department_id=9 anything. A real Operations manager passes the frontend
-- gate, calls the RPC, and gets all-zero KPIs (open orders, fill rate, stock
-- position, backlog aging, everything) -- only an MGM manager or superadmin
-- calling the identical RPC sees real data.
--
-- Read-only, matching every other department's own rights on these SAP-
-- mirrored tables. sap_sales_orders/sap_sales_order_lines/sap_deliveries/
-- sap_delivery_lines/sap_items already have policies from other
-- departments (Sales, and MGM via mgm_sales_access_parity_fix.sql) -- this
-- file only adds the missing OPS grant alongside them, it doesn't touch
-- those. sap_invoices/sap_invoice_lines get an OPS grant here for the first
-- time (Finance's own gap on those two is separately fixed in
-- finance_department_access_fix.sql).
--
-- Idempotent: safe to re-run.

drop policy if exists "Operations Department VIEW" on public.sap_sales_orders;
create policy "Operations Department VIEW" on public.sap_sales_orders
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);

drop policy if exists "Operations Department VIEW" on public.sap_sales_order_lines;
create policy "Operations Department VIEW" on public.sap_sales_order_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);

drop policy if exists "Operations Department VIEW" on public.sap_deliveries;
create policy "Operations Department VIEW" on public.sap_deliveries
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);

drop policy if exists "Operations Department VIEW" on public.sap_delivery_lines;
create policy "Operations Department VIEW" on public.sap_delivery_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);

drop policy if exists "Operations Department VIEW" on public.sap_items;
create policy "Operations Department VIEW" on public.sap_items
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);

drop policy if exists "Operations Department VIEW" on public.sap_invoices;
create policy "Operations Department VIEW" on public.sap_invoices
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);

drop policy if exists "Operations Department VIEW" on public.sap_invoice_lines;
create policy "Operations Department VIEW" on public.sap_invoice_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'OPS'
  )
);
