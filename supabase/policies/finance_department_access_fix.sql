-- Run this once in the Supabase SQL editor.
--
-- Confirmed live via a full pg_policies audit (2026-09): Finance (department
-- sub 'FIN', id 15) has NO policy anywhere in the database -- not one row
-- across the entire schema references department_id = 15. Every one of
-- these tables' live policies are "Management VIEW" (MGM manager only) +
-- "Sales Manager VIEW" (on the AR-side tables) + "Superadmin CRUD" --
-- Finance was simply never added to the template when these tables/
-- policies were created.
--
-- Impact confirmed against real frontend consumers: FinanceRoutes.jsx gates
-- Invoices/Payments/Bills/VendorPayments/JournalEntries/ChartOfAccounts to
-- department "FIN" with no role restriction (both staff and manager are the
-- intended audience), and every one of those pages reads its table directly
-- (invoicesService.js -> sap_invoices/sap_invoice_lines, paymentsService.js
-- -> sap_payments, fetchPaymentApplications.js -> sap_payment_applications,
-- billsService.js -> sap_vendor_bills, fetchBillLines.js ->
-- sap_vendor_bill_lines, vendorPaymentsService.js -> sap_vendor_payments,
-- fetchVendorPaymentApplications.js -> sap_vendor_payment_applications,
-- journalEntriesService.js -> sap_gl_journal_entries, fetchJournalEntryLines
-- .js -> sap_gl_journal_lines, chartOfAccountsService.js -> sap_gl_accounts)
-- -- meaning a real Finance staffer or manager opening any of these six
-- pages today gets an empty table. get_finance_dashboard_rpc.sql's own
-- direct reads (not the GL materialized-view-derived figures) hit the same
-- wall for a real FIN caller: salesRepRevenueData (joins sap_sales_persons),
-- and every AR/AP/bank KPI sourced from sap_invoices/sap_payments/
-- sap_payment_applications/sap_vendor_bills/sap_vendor_payments/
-- sap_vendor_payment_applications/sap_bank_account_movements.
-- financeMetadataService.js's customer/vendor filter dropdowns
-- (sap_customers, sap_sales_persons) are equally empty for a FIN caller.
--
-- Read-only, matching every other department's own rights on these SAP-
-- mirrored tables (SAP is the system of record -- nobody in this app writes
-- to sap_* tables directly, confirmed by every Finance service file being a
-- plain SELECT-only service with no insert/update/delete).
--
-- Idempotent: safe to re-run.

drop policy if exists "Finance Department VIEW" on public.sap_invoices;
create policy "Finance Department VIEW" on public.sap_invoices
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_invoice_lines;
create policy "Finance Department VIEW" on public.sap_invoice_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_payments;
create policy "Finance Department VIEW" on public.sap_payments
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_payment_applications;
create policy "Finance Department VIEW" on public.sap_payment_applications
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_vendor_bills;
create policy "Finance Department VIEW" on public.sap_vendor_bills
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_vendor_bill_lines;
create policy "Finance Department VIEW" on public.sap_vendor_bill_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_vendor_payments;
create policy "Finance Department VIEW" on public.sap_vendor_payments
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_vendor_payment_applications;
create policy "Finance Department VIEW" on public.sap_vendor_payment_applications
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_gl_accounts;
create policy "Finance Department VIEW" on public.sap_gl_accounts
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_gl_journal_entries;
create policy "Finance Department VIEW" on public.sap_gl_journal_entries
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_gl_journal_lines;
create policy "Finance Department VIEW" on public.sap_gl_journal_lines
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_bank_codes;
create policy "Finance Department VIEW" on public.sap_bank_codes
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_bank_account_details;
create policy "Finance Department VIEW" on public.sap_bank_account_details
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_bank_account_movements;
create policy "Finance Department VIEW" on public.sap_bank_account_movements
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

-- Filter-dropdown dependencies (financeMetadataService.js) -- Finance
-- doesn't own these tables, just needs to read them the same way Sales/MGM
-- already can.
drop policy if exists "Finance Department VIEW" on public.sap_customers;
create policy "Finance Department VIEW" on public.sap_customers
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);

drop policy if exists "Finance Department VIEW" on public.sap_sales_persons;
create policy "Finance Department VIEW" on public.sap_sales_persons
for select to authenticated
using (
  exists (
    select 1 from profiles p
    join departments d on d.id = p.department_id
    where p.id = auth.uid() and d.sub = 'FIN'
  )
);
