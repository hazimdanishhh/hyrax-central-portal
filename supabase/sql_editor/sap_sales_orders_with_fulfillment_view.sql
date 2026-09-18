-- Run this once in the Supabase SQL editor.
--
-- Backs the Sales Orders page directly (/app/sales/orders/all) -- Lead ->
-- Order -> Delivered -> Invoiced -> Fully Paid, per
-- docs/SALES-ORDER-PIPELINE-ROADMAP.md §2.2. Briefly lived as a separate
-- standalone Fulfillment Tracker page/route for about a day before being
-- folded directly into Sales Orders -- the two pages had no cross-links
-- between them and read as duplicate, unrelated features rather than one
-- view being richer than the other.
--
-- fetchFulfillmentOrders (fulfillmentOrdersService.js, now under
-- features/sales/orders/) queries this view for the page's list/cards/KPI
-- strip. Its pagination count is decoupled from the data fetch: when only
-- base-column filters are active, the count comes from the cheap raw
-- sap_sales_orders table instead of this view -- valid because every
-- lateral below is an UNGROUPED aggregate subquery (`on true`, no
-- GROUP BY, no fan-out join), so row cardinality is provably identical to
-- the base table. INVARIANT: if this view ever gains a GROUP BY lateral or
-- a plain 1:N join, that optimization must be reverted. salesOrdersService.js's
-- own fetchSalesOrders (the raw table) is kept separately for the
-- PO-number/customer-code lookup hooks, which don't need enrichment.
--
-- Mirrors finance_outstanding_balance_views.sql's own shape exactly
-- (additive `left join lateral` columns, security_invoker on).
--
-- has_matched_lead (added 2026-09): a cheap correlated EXISTS against
-- sales_leads.po_number = customer_ref (unique on the lead side, per
-- SALES-ORDER-PIPELINE-ROADMAP.md §1.2) -- needed so the Fulfillment
-- Tracker's own list CARD can show the Lead Matched stage correctly
-- without an N+1 per-row fetch (the sidebar still uses useLeadByPoNumber
-- directly for the full lead record, since it needs the id to link to, not
-- just the boolean). Unlike the invoice/payment rollup below, this is a
-- single indexed exact-match lookup (po_number is UNIQUE), not a real
-- aggregation, so it doesn't reintroduce the cost problem that got the
-- invoice/payment rollup scoped off the paginated list in the first place.
--
-- "Delivered" signal, deliberately NOT primarily sap_deliveries: a live
-- audit (2026-08, see invoicesService.js's/salesOrdersService.js's own
-- fetchInvoicesForSalesOrder/fetchSalesOrdersForInvoice comments) confirmed
-- sap_deliveries has had zero rows since 2022-05-25, and that table has no
-- OpenQty/DelivrdQty column at all even historically. The PRIMARY signal
-- used here instead -- sap_sales_order_lines.open_qty/delivered_qty -- is
-- already this app's own proven, live fulfillment source
-- (get_operations_dashboard_rpc.sql's undeliveredUnits = sum(open_qty)).
-- sap_deliveries is still joined below, but purely as an informational
-- delivery_record_count -- it will legitimately read 0 for almost every
-- current order, which is expected, not a bug. status_code = 'C' is
-- deliberately NOT used as a delivered-signal at all: it's order-level only
-- and SAP B1 can also manually close an order while still partially open,
-- so a closed order isn't reliably the same fact as a fully delivered one
-- -- neither this repo nor hyrax-data-platform's docs disambiguate which
-- happened for any given closed order.
create or replace view public.sap_sales_orders_with_fulfillment as
select
    so.*,
    coalesce(lf.total_open_qty, 0) as total_open_qty,
    coalesce(lf.total_delivered_qty, 0) as total_delivered_qty,
    (coalesce(lf.total_open_qty, 0) <= 0) as is_fully_delivered,
    coalesce(di.delivery_count, 0) as delivery_record_count,
    coalesce(ir.matched_invoice_count, 0) as matched_invoice_count,
    coalesce(ir.total_invoiced_myr, 0) as total_invoiced_myr,
    coalesce(ir.total_paid_myr, 0) as total_paid_myr,
    coalesce(ir.total_applied_myr, 0) as total_applied_myr,
    coalesce(ir.total_outstanding_myr, 0) as total_outstanding_myr,
    (abs(coalesce(ir.total_paid_myr, 0) - coalesce(ir.total_applied_myr, 0)) > 0.01) as has_paid_mismatch,
    (coalesce(ir.matched_invoice_count, 0) > 0 and coalesce(ir.total_outstanding_myr, 0) <= 0.01) as is_fully_paid,
    -- Appended LAST, deliberately -- CREATE OR REPLACE VIEW can only add
    -- columns at the end of the SELECT list; this view had already been
    -- deployed once before this column existed, so inserting it any earlier
    -- (even right after so.*) fails with "cannot change name of view column
    -- ... to ..." because every already-deployed column after that point
    -- would have to shift position.
    exists (
        select 1 from public.sales_leads sl where sl.po_number = so.customer_ref
    ) as has_matched_lead
from public.sap_sales_orders so
left join lateral (
    select
        coalesce(sum(open_qty), 0) as total_open_qty,
        coalesce(sum(delivered_qty), 0) as total_delivered_qty
    from public.sap_sales_order_lines
    where doc_entry = so.doc_entry
) lf on true
left join lateral (
    select count(*) as delivery_count
    from public.sap_deliveries d
    join public.sap_delivery_lines dl on dl.doc_entry = d.doc_entry
    where dl.base_entry = so.doc_entry and dl.base_type = 17
      and d.is_cancelled = 'N'
) di on true
left join lateral (
    -- Mirrors fetchInvoicesForSalesOrder's own two confirmed branches
    -- (invoicesService.js) -- direct (base_type=17) and via-delivery
    -- (base_type=15), kept for historical correctness even though the
    -- delivery hop is dead data post-2022-05-25.
    with matched_invoice_ids as (
        select distinct il.doc_entry
        from public.sap_invoice_lines il
        where il.base_entry = so.doc_entry and il.base_type = 17
        union
        select distinct il2.doc_entry
        from public.sap_delivery_lines dl2
        join public.sap_invoice_lines il2 on il2.base_entry = dl2.doc_entry and il2.base_type = 15
        where dl2.base_entry = so.doc_entry and dl2.base_type = 17
    )
    select
        count(*) as matched_invoice_count,
        coalesce(sum(i.total_amount_myr), 0) as total_invoiced_myr,
        coalesce(sum(i.paid_to_date), 0) as total_paid_myr,
        coalesce(sum(i.applied_payment_myr), 0) as total_applied_myr,
        coalesce(sum(i.outstanding_balance), 0) as total_outstanding_myr
    from matched_invoice_ids m
    join public.sap_invoices_with_balance i on i.doc_entry = m.doc_entry
    where i.is_cancelled = 'N'
) ir on true;

-- CRITICAL -- without this, this view silently runs as its OWNER, meaning
-- sap_sales_orders'/sap_invoices_with_balance's/sap_deliveries' existing
-- per-department RLS policies never actually apply through it -- same gap
-- this repo's own enable_attendance_views_security_invoker.sql already
-- fixed once, and the same reasoning finance_outstanding_balance_views.sql
-- already documents.
alter view public.sap_sales_orders_with_fulfillment set (security_invoker = on);

-- Added 2026-09, alongside the fix that scoped this view's usage down to a
-- single order per fetch (see salesOrdersService.js's own comment on
-- fetchSalesOrders): sap_invoice_lines'/sap_delivery_lines' own primary keys
-- are (doc_entry, line_num), which does NOT cover a base_entry/base_type
-- lookup -- every one of this view's (and fetchInvoicesForSalesOrder's/
-- fetchSalesOrdersForInvoice's own pre-existing JS) base_entry/base_type
-- joins was a full table scan without these. Safe/idempotent to re-run;
-- benefits the existing JS-side document-trail lookups too, not just this
-- view.
create index if not exists idx_sap_invoice_lines_base_entry_type
    on public.sap_invoice_lines (base_entry, base_type);

create index if not exists idx_sap_delivery_lines_base_entry_type
    on public.sap_delivery_lines (base_entry, base_type);
