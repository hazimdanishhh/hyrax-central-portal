-- Run this once in the Supabase SQL editor.
--
-- Context: mirrors supabase/policies/mgm_sales_access_parity_fix.sql's own
-- reasoning, applied to Finance instead of Sales. 2026-07's "Judgment call
-- #4" (supabase/access-control/README.md) deliberately dropped MGM from
-- Finance's six Tier-1 operational pages (Invoices, Payments, Bills, Vendor
-- Payments, Journal Entries, Chart of Accounts) -- never reversed, unlike
-- Sales' identical 2026-07 restriction on Clients/Leads/Orders, which WAS
-- reversed in 2026-09 (mgm_sales_access_parity_fix.sql). 2026-09: reversed
-- the same way for Finance -- MGM staff need to actually open these pages,
-- not just see a disabled drill-through link/card from Finance Reports,
-- Sales Reports, or a Sales Order's "MATCHED INVOICE(S)"/"MATCHED
-- PAYMENT(S)" sidebar cards. The frontend route-guard change
-- (FinanceRoutes.jsx, sideNavLinkData.js, departmentLinkCardData.js, plus
-- the drill-through canAccess() flags in FinancialReports.jsx/Reports.jsx/
-- SalesOrderSidebar.jsx) is not sufficient on its own: a non-manager MGM
-- staffer could already open these pages, but every one of these tables'
-- only existing MGM grant is the old manager-only "Management VIEW"
-- (profiles.role_id/department_id, not the newer departments.sub join), so
-- the query would come back empty.
--
-- Read-only, department-wide (no role restriction), matching Sales' own
-- SAP-mirrored-table treatment: SAP is the system of record for every table
-- below, nobody in this app writes to them, so there's no CRUD case to add
-- (unlike sales_leads/clients, which are native app tables).
--
-- Deliberately EXCLUDED: sap_bank_codes, sap_bank_account_details,
-- sap_bank_account_movements. These back Cash Flow only, which stays
-- manager-gated (departments:["FIN","MGM"], roles:["manager"]) -- a
-- separate, already-flagged "KNOWN OPEN DISCREPANCY" (FinanceRoutes.jsx's
-- own comment) that this pass does not touch. Their existing manager-only
-- "Management VIEW" policy is correct as-is for that gate and must not be
-- widened here. sap_customers/sap_sales_persons already have company-wide
-- MGM access from mgm_sales_access_parity_fix.sql -- no change needed.
--
-- Idempotent: each block drops the old manager-only policy by name before
-- creating its replacement, so this is safe to re-run.

-- === sap_invoices / sap_invoice_lines ===
drop policy if exists "Management VIEW" on public.sap_invoices;
create policy "MGM Department VIEW" on public.sap_invoices
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_invoice_lines;
create policy "MGM Department VIEW" on public.sap_invoice_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

-- === sap_payments / sap_payment_applications ===
drop policy if exists "Management VIEW" on public.sap_payments;
create policy "MGM Department VIEW" on public.sap_payments
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_payment_applications;
create policy "MGM Department VIEW" on public.sap_payment_applications
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

-- === sap_vendor_bills / sap_vendor_bill_lines ===
drop policy if exists "Management VIEW" on public.sap_vendor_bills;
create policy "MGM Department VIEW" on public.sap_vendor_bills
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_vendor_bill_lines;
create policy "MGM Department VIEW" on public.sap_vendor_bill_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

-- === sap_vendor_payments / sap_vendor_payment_applications ===
drop policy if exists "Management VIEW" on public.sap_vendor_payments;
create policy "MGM Department VIEW" on public.sap_vendor_payments
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_vendor_payment_applications;
create policy "MGM Department VIEW" on public.sap_vendor_payment_applications
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

-- === General Ledger: sap_gl_accounts / sap_gl_journal_entries /
-- sap_gl_journal_lines (backs Journal Entries + Chart of Accounts, both
-- part of this reversal) ===
drop policy if exists "Management VIEW" on public.sap_gl_accounts;
create policy "MGM Department VIEW" on public.sap_gl_accounts
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_gl_journal_entries;
create policy "MGM Department VIEW" on public.sap_gl_journal_entries
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);

drop policy if exists "Management VIEW" on public.sap_gl_journal_lines;
create policy "MGM Department VIEW" on public.sap_gl_journal_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'MGM'
  )
);
