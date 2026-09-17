-- Run this once in the Supabase SQL editor.
--
-- Exposes "remaining balance" (total_amount_myr - paid_to_date) as a real,
-- filterable column for Invoices/Bills -- today it's only computable inline
-- (get_invoices_overview_rpc.sql / get_bills_overview_rpc.sql already do
-- this correctly), which means the LIST page can't filter by it: PostgREST's
-- REST filtering only works against real columns, not an arbitrary
-- arithmetic expression across two columns. That gap is why clicking the
-- Outstanding/Due Soon/Overdue/Critically Overdue KPI tiles' drill-through
-- link only narrows to `status_code`/`is_cancelled` -- the list then shows
-- ALL open bills/invoices, a superset of what the KPI actually counted (open
-- AND with a real remaining balance). The KPI numbers themselves were
-- already correct; this view lets the list finally filter down to match
-- them, via a new `hasBalanceOnly` filter (see invoicesService.js/
-- billsService.js).
--
-- `select *` is safe/stable here: Postgres resolves a view's `*` against
-- the underlying table's columns at CREATE time, and re-resolves it on
-- every `CREATE OR REPLACE VIEW`, so an eventual new sap_invoices/
-- sap_vendor_bills column (from a future hyrax-data-platform extractor
-- change) would automatically appear here too, not silently go missing.
--
-- applied_payment_myr (added 2026-09): a SECOND, independent measure of
-- "how much has actually been paid" -- the sum of this document's own
-- ACTIVE (non-cancelled) sap_payment_applications rows, mirroring
-- get_finance_dashboard_rpc.sql's existing base_payment_apps/
-- base_vendor_payment_apps CTE shape, just per-document instead of
-- company-wide. This is deliberately kept as a SEPARATE column from
-- paid_to_date, not blended into outstanding_balance -- the two can
-- legitimately disagree (paid_to_date is SAP's own OINV/OPCH running
-- total; applied_payment_myr is derived from RCT2/VPM2 application rows,
-- which this app's own extractor only re-syncs on a 60-day lookback for
-- payments, not for invoices/bills -- see hyrax-data-platform's
-- payments.py RCT2_LOOKBACK_DAYS comment), and the whole point of exposing
-- both on the card is to make that gap visible, not paper over it. Uses
-- `left join lateral` (not a pre-aggregated `group by` derived table) so
-- Postgres can correlate/push the i.doc_entry predicate down per row,
-- the efficient shape for a paginated view -- though at this app's
-- documented data scale (<100MB, ~20k rows, DASHBOARD-CONVENTIONS.md's own
-- "Scale note") either shape would be fine.
-- has_paid_mismatch (added 2026-09): exposes the applied_payment_myr-vs-
-- paid_to_date comparison itself as a real, filterable boolean column --
-- same reasoning as outstanding_balance/hasBalanceOnly above: PostgREST
-- can't filter on an arithmetic comparison across two columns directly, so
-- the comparison has to be computed here to become filterable
-- (`paidMismatchOnly`, see invoicesService.js/billsService.js). Same 0.01
-- epsilon guard used throughout this app for floating-point-settled
-- balances (see get_invoices_overview_rpc.sql's own outstandingCount).
create or replace view public.sap_invoices_with_balance as
select
    i.*,
    (i.total_amount_myr - i.paid_to_date) as outstanding_balance,
    coalesce(pa.applied_payment_myr, 0) as applied_payment_myr,
    (abs(i.paid_to_date - coalesce(pa.applied_payment_myr, 0)) > 0.01) as has_paid_mismatch
from public.sap_invoices i
left join lateral (
    select sum(pa.amount_applied_myr) as applied_payment_myr
    from public.sap_payment_applications pa
    join public.sap_payments p on pa.payment_ref = p.doc_entry
    where pa.doc_entry = i.doc_entry
      and pa.inv_type = 13
      and p.is_cancelled = 'N'
) pa on true;

create or replace view public.sap_vendor_bills_with_balance as
select
    b.*,
    (b.total_amount_myr - b.paid_to_date) as outstanding_balance,
    coalesce(pa.applied_payment_myr, 0) as applied_payment_myr,
    (abs(b.paid_to_date - coalesce(pa.applied_payment_myr, 0)) > 0.01) as has_paid_mismatch
from public.sap_vendor_bills b
left join lateral (
    select sum(pa.amount_applied_myr) as applied_payment_myr
    from public.sap_vendor_payment_applications pa
    join public.sap_vendor_payments p on pa.payment_ref = p.doc_entry
    where pa.doc_entry = b.doc_entry
      and pa.doc_type = 18
      and p.is_cancelled = 'N'
) pa on true;

-- CRITICAL -- without this, both views silently run as their OWNER (the
-- role that pasted this script, not the querying user), which means
-- sap_invoices'/sap_vendor_bills' existing per-department RLS policies
-- never actually apply through them -- the exact gap this repo's own
-- enable_attendance_views_security_invoker.sql already fixed once for
-- unified_daily_attendance/attendance_activity_audit. security_invoker is a
-- reloption, not a column, so this is safe/trivial to toggle independently:
--   alter view public.sap_invoices_with_balance set (security_invoker = false);
--   alter view public.sap_vendor_bills_with_balance set (security_invoker = false);
alter view public.sap_invoices_with_balance set (security_invoker = on);
alter view public.sap_vendor_bills_with_balance set (security_invoker = on);
