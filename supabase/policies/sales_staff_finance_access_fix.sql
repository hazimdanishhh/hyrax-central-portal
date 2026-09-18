-- Run this once in the Supabase SQL editor.
--
-- sap_invoices, sap_invoice_lines, sap_payments, and sap_payment_applications
-- each already have a "Sales Manager VIEW" policy (role_id = 2, department_id
-- = 3, department-wide, read-only) -- confirmed via a live pg_policies export
-- (docs/TABLE-POLICIES.csv) -- but no paired "Sales Staff VIEW", unlike every
-- other SAP-mirrored table Sales reads (sap_customers, sap_items,
-- sap_sales_orders, sap_sales_order_lines, sap_sales_persons all have both).
-- A non-manager Sales user opening the merged Sales Orders page would
-- otherwise see the fulfillment view's invoice/payment columns silently read
-- as zero/empty -- not an error, RLS just returns no rows.
--
-- Department-wide, matching the sibling Manager policy's own scope exactly --
-- deliberately NOT self-scoped by sales_rep_code (decided with the user:
-- sap_sales_orders/sap_sales_order_lines already grant BOTH tiers full
-- department-wide access today, so self-scoping only the new grants would
-- create an inconsistent tier within the same page; self-scoping-by-rep
-- across the whole chain is left as a separate, later decision).
--
-- Uses the same hardcoded role_id/department_id style as the sibling "Sales
-- Manager VIEW" policy already on each table (not the newer
-- departments.sub-join style used elsewhere), so the two read as an obvious
-- pair. Idempotent: safe to re-run.

drop policy if exists "Sales Staff VIEW" on public.sap_invoices;
create policy "Sales Staff VIEW" on public.sap_invoices
for select to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role_id = 1 and profiles.department_id = 3
  )
);

drop policy if exists "Sales Staff VIEW" on public.sap_invoice_lines;
create policy "Sales Staff VIEW" on public.sap_invoice_lines
for select to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role_id = 1 and profiles.department_id = 3
  )
);

drop policy if exists "Sales Staff VIEW" on public.sap_payments;
create policy "Sales Staff VIEW" on public.sap_payments
for select to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role_id = 1 and profiles.department_id = 3
  )
);

drop policy if exists "Sales Staff VIEW" on public.sap_payment_applications;
create policy "Sales Staff VIEW" on public.sap_payment_applications
for select to authenticated
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role_id = 1 and profiles.department_id = 3
  )
);
