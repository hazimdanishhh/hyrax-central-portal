-- ############################################################################
-- v_sales_orderbook_open -- what is still owed to us, and how old it is
--
-- Phase A of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on sap_sales_orders + sap_invoice_lines.
--
-- One row per order carrying uninvoiced value, with its age in months. This is
-- the input side of §5.1: the chain-ladder applies development factors to
-- these remaining balances to project forward invoicing.
--
-- REMAINING VALUE IS COMPUTED HERE, AT LINE LEVEL -- deliberately
--
-- It does NOT read sap_sales_orders_with_fulfillment.total_invoiced_myr.
-- That column sums whole invoice DOCUMENTS per order, so an invoice spanning
-- two orders is counted in full against both, and an invoice mixing
-- order-linked lines with direct lines attributes the direct lines to the
-- order as well. It over-states, always. See that view's header block and
-- DASHBOARD-ROADMAP.md §4 Group C -- it is a live user-visible defect on the
-- Fulfillment page, tracked separately.
--
-- Here, invoiced value is sum(sap_invoice_lines.line_total) where
-- base_entry = the order and base_type = 17. Exact, and the same attribution
-- Q1/Q3 of the order-book diagnostic already validated.
--
-- "OPEN" MEANS REMAINING VALUE, NOT status_code
--
-- status_code is not used to decide what is open. Q6 found 90.6% of
-- status_code = 'O' orders already past their delivery date and 56.9% more
-- than 90 days past, which says the field is not maintained closely enough to
-- drive a forecast. remaining_myr > 0 is an arithmetic fact about invoices
-- actually raised; status_code is carried through for reference only.
--
-- OVER-INVOICING IS FLOORED AT ZERO
--
-- remaining_myr can go negative -- price adjustments, an invoice raised
-- slightly above the order. greatest(..., 0) stops those orders contributing
-- NEGATIVE expected revenue to the projection, which would quietly offset real
-- forward value elsewhere. is_over_invoiced flags them so the count is
-- visible rather than silently swallowed.
--
-- AGE IS CAPPED FOR MODELLING, NOT FILTERED
--
-- Nothing is excluded by age. 97.9% of order value converts within 12 months
-- (Q4), so an order still carrying value at 36 months is almost certainly dead
-- or mis-keyed rather than pending. age_months is exposed so the model can
-- apply a cut-off and the diagnostics can show how much value sits beyond it.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- ############################################################################

drop view if exists public.v_sales_orderbook_open cascade;

create view public.v_sales_orderbook_open
with (security_invoker = on) as

with invoiced as (
    select il.base_entry              as doc_entry,
           sum(il.line_total)         as invoiced_myr,
           count(distinct il.doc_entry) as invoice_count,
           max(i.invoice_date::date)  as last_invoice_date
    from public.sap_invoice_lines il
    join public.sap_invoices i
      on i.doc_entry = il.doc_entry
     and i.is_cancelled = 'N'
    where il.base_type = 17
      and il.base_entry is not null
    group by il.base_entry
)

select so.doc_entry,
       so.so_number,
       so.order_date::date                                        as order_date,
       date_trunc('month', so.order_date::date)::date              as order_month,
       so.customer_code,
       so.customer_name,
       so.sales_rep_code,
       so.status_code,

       so.total_amount_myr                                        as ordered_myr,
       coalesce(inv.invoiced_myr, 0)                              as invoiced_myr,
       greatest(so.total_amount_myr - coalesce(inv.invoiced_myr, 0), 0)
                                                                  as remaining_myr,
       (so.total_amount_myr - coalesce(inv.invoiced_myr, 0)) < 0  as is_over_invoiced,

       coalesce(inv.invoice_count, 0)                             as invoice_count,
       inv.last_invoice_date,

       -- Whole months from the order's month to the current month. An order
       -- placed this month is age 0.
       ( (extract(year  from current_date) - extract(year  from so.order_date::date)) * 12
       + (extract(month from current_date) - extract(month from so.order_date::date))
       )::int                                                     as age_months,

       case
         when coalesce(inv.invoiced_myr, 0) <= 0 then 'not invoiced'
         when so.total_amount_myr - coalesce(inv.invoiced_myr, 0) > 0 then 'part invoiced'
         else 'fully invoiced'
       end                                                        as invoice_state

from public.sap_sales_orders so
left join invoiced inv on inv.doc_entry = so.doc_entry
where so.is_cancelled = 'N'
  and so.total_amount_myr > 0
  and so.total_amount_myr - coalesce(inv.invoiced_myr, 0) > 0;


comment on view public.v_sales_orderbook_open is
    'Orders still carrying uninvoiced value, with age in months. Remaining '
    'value computed at LINE level (sap_invoice_lines, base_type = 17) -- NOT '
    'from sap_sales_orders_with_fulfillment.total_invoiced_myr, which '
    'over-states. Openness is defined by remaining value, not status_code.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseA_verification.sql
-- Run them one at a time, after this file has succeeded.
