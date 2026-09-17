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
create or replace view public.sap_invoices_with_balance as
select
    i.*,
    (i.total_amount_myr - i.paid_to_date) as outstanding_balance
from public.sap_invoices i;

create or replace view public.sap_vendor_bills_with_balance as
select
    b.*,
    (b.total_amount_myr - b.paid_to_date) as outstanding_balance
from public.sap_vendor_bills b;

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
