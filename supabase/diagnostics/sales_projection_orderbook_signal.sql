-- ############################################################################
-- ORDER BOOK SIGNAL -- is a bottom-up projection viable?
--
-- Step 5 evidence. Read-only. No DDL, no writes.
--
-- THE QUESTION
--
-- Steps 1-4 proved invoiced revenue cannot be usefully extrapolated from its
-- own history (architecture doc §11b): the best method misses by ~38% of a
-- typical month, because revenue arrives as a handful of large tenders and
-- tenders do not follow a calendar.
--
-- But an invoice is almost always preceded by a sales order. At the start of
-- any month there is an open order book -- work customers have already
-- committed to, with delivery dates attached, not yet invoiced. A time-series
-- model throws all of that away and looks only at the output history.
--
-- So: HOW MUCH OF A MONTH'S INVOICING WAS ALREADY KNOWN WHEN THE MONTH BEGAN?
--
-- That single number decides whether a bottom-up projection is worth building:
--
--     > 70%   Most of next month is already observable. Build it -- this
--             would be dramatically more accurate than anything in §11b.
--     40-70%  Partial signal. Worth building as "committed vs expected",
--             with the uncovered portion shown honestly as a gap.
--     < 40%   Invoicing is mostly same-month business that never sits in the
--             order book. A bottom-up model would not help either. Stop.
--
-- THE JOIN
--
-- sap_invoice_lines.base_entry -> sap_sales_orders.doc_entry, filtered
-- base_type = 17 (17 = Sales Order; 15 = Delivery). Line-level, because one
-- invoice can draw on several orders and one order can be invoiced in parts.
--
-- Invoice lines with base_type <> 17, or base_entry null, are invoices raised
-- with NO sales order behind them -- direct/counter sales. Those are the
-- genuinely unpredictable part, and Q2 measures them specifically.
--
-- HOW TO RUN
--
-- One block at a time. Save each grid to
-- diagnostics/results/projection/orderbook/ as Q1.csv, Q2.csv, ...
-- ############################################################################


-- ############################################################################
-- Q1 -- Coverage: what share of invoiced value traces back to a sales order?
--
-- The ceiling on the whole idea. If only half of invoiced revenue has an order
-- behind it, a bottom-up model can never explain more than half.
--
-- Run first. If linked_pct is low everywhere, stop and read Q2 to find out
-- what the unlinked half actually is.
-- ############################################################################
with inv_lines as (
    select date_trunc('month', i.invoice_date::date)::date as period_month,
           il.line_total,
           (il.base_type = 17 and il.base_entry is not null) as from_order
    from public.sap_invoice_lines il
    join public.sap_invoices i on i.doc_entry = il.doc_entry
    where i.is_cancelled = 'N'
      and i.invoice_date::date >= date '2023-01-01'
)
select period_month,
       round(sum(line_total))                                    as invoiced_myr,
       round(sum(line_total) filter (where from_order))          as from_order_myr,
       round(sum(line_total) filter (where not from_order))      as direct_myr,
       round(100.0 * sum(line_total) filter (where from_order)
             / nullif(sum(line_total), 0), 1)                    as linked_pct
from inv_lines
group by period_month
order by period_month;


-- ############################################################################
-- Q2 -- The same thing, summarised, plus what the unlinked portion is
--
-- base_type tells us what each invoice line was raised against:
--   17  = Sales Order      (predictable -- it was in the order book)
--   15  = Delivery         (also predictable, one step further down the chain)
--   null/other = raised directly, no preceding document
-- ############################################################################
select coalesce(il.base_type::text, 'none')              as base_type,
       case il.base_type
            when 17 then 'Sales Order'
            when 15 then 'Delivery'
            else 'direct / no preceding document'
       end                                               as meaning,
       count(*)                                          as line_count,
       round(sum(il.line_total))                         as value_myr,
       round(100.0 * sum(il.line_total)
             / sum(sum(il.line_total)) over (), 1)       as pct_of_total
from public.sap_invoice_lines il
join public.sap_invoices i on i.doc_entry = il.doc_entry
where i.is_cancelled = 'N'
  and i.invoice_date::date >= date '2023-01-01'
group by il.base_type
order by value_myr desc nulls last;


-- ############################################################################
-- Q3 -- THE HEADLINE NUMBER: how much of a month was already booked?
--
-- For each invoice line that came from an order, compare the month it was
-- INVOICED against the month the ORDER was placed. If the order predates the
-- invoice month, that revenue was already sitting in the book when the month
-- began -- i.e. knowable in advance.
--
--   already_booked_pct  = invoiced value whose order was placed in an EARLIER
--                         month (visible at month start)
--   same_month_pct      = ordered and invoiced within the same month
--                         (NOT visible at month start)
--   no_order_pct        = direct invoices, no order at all
--
-- already_booked_pct IS THE DECISION NUMBER. Read its average across months.
-- ############################################################################
with inv_lines as (
    select date_trunc('month', i.invoice_date::date)::date as inv_month,
           date_trunc('month', so.order_date::date)::date  as ord_month,
           il.line_total
    from public.sap_invoice_lines il
    join public.sap_invoices i
      on i.doc_entry = il.doc_entry
    left join public.sap_sales_orders so
      on so.doc_entry = il.base_entry
     and il.base_type = 17
     and so.is_cancelled = 'N'
    where i.is_cancelled = 'N'
      and i.invoice_date::date >= date '2023-01-01'
)
select inv_month,
       round(sum(line_total))                                              as invoiced_myr,
       round(100.0 * sum(line_total) filter (where ord_month < inv_month)
             / nullif(sum(line_total), 0), 1)                              as already_booked_pct,
       round(100.0 * sum(line_total) filter (where ord_month = inv_month)
             / nullif(sum(line_total), 0), 1)                              as same_month_pct,
       round(100.0 * sum(line_total) filter (where ord_month is null)
             / nullif(sum(line_total), 0), 1)                              as no_order_pct
from inv_lines
group by inv_month
order by inv_month;


-- ############################################################################
-- Q4 -- Conversion lag: once an order is placed, when does it invoice?
--
-- The development pattern a bottom-up model would apply. lag_months = 0 means
-- ordered and invoiced in the same month.
--
-- A tight distribution (most value at lag 0-2) means the order book is a
-- SHORT-range predictor -- good for next month, useless for 12. A long tail
-- means orders sit in the book for months, which is better for a forward view.
-- ############################################################################
with conv as (
    select ( (extract(year  from i.invoice_date::date) - extract(year  from so.order_date::date)) * 12
           + (extract(month from i.invoice_date::date) - extract(month from so.order_date::date))
           )::int as lag_months,
           il.line_total
    from public.sap_invoice_lines il
    join public.sap_invoices i      on i.doc_entry  = il.doc_entry
    join public.sap_sales_orders so on so.doc_entry = il.base_entry
    where il.base_type = 17
      and i.is_cancelled  = 'N'
      and so.is_cancelled = 'N'
      and i.invoice_date::date >= date '2023-01-01'
)
select lag_months,
       count(*)                                                      as line_count,
       round(sum(line_total))                                        as value_myr,
       round(100.0 * sum(line_total) / sum(sum(line_total)) over (), 1) as pct_of_value,
       round(100.0 * sum(sum(line_total)) over (order by lag_months)
             / sum(sum(line_total)) over (), 1)                      as cumulative_pct
from conv
where lag_months between -1 and 24
group by lag_months
order by lag_months;


-- ############################################################################
-- Q5 -- What is in the order book RIGHT NOW, by scheduled delivery month?
--
-- The forward view a bottom-up projection would actually show. Open orders
-- (status_code = 'O'), grouped by their SAP delivery date (DocDueDate).
--
-- Compare the next few months here against the ~RM3.5M/month the business has
-- been invoicing in 2026. If the book is thin, that is itself a finding worth
-- putting in front of the sales director -- independent of any model.
--
-- NOTE: delivery_date is the REQUESTED date and may be stale on long-open
-- orders. Q6 checks how much of the book is already overdue.
-- ############################################################################
select date_trunc('month', so.delivery_date::date)::date as delivery_month,
       count(*)                                          as open_orders,
       round(sum(so.total_amount_myr))                   as open_value_myr
from public.sap_sales_orders so
where so.is_cancelled = 'N'
  and so.status_code  = 'O'
  and so.delivery_date is not null
group by 1
order by 1;


-- ############################################################################
-- Q6 -- Order book health: how much is past its delivery date?
--
-- A bottom-up projection is only as good as the delivery dates it reads. If
-- most of the open book is already overdue, those dates are not maintained and
-- the projection must lean on the Q4 lag distribution instead of on
-- delivery_date.
--
-- This is the single assumption most likely to break the whole approach, so it
-- is measured before anything is built rather than discovered afterwards.
-- ############################################################################
select case
         when so.delivery_date is null                        then 'no delivery date'
         when so.delivery_date::date <  current_date - 180     then 'overdue > 180d'
         when so.delivery_date::date <  current_date - 90      then 'overdue 90-180d'
         when so.delivery_date::date <  current_date - 30      then 'overdue 30-90d'
         when so.delivery_date::date <  current_date           then 'overdue < 30d'
         when so.delivery_date::date <= current_date + 30      then 'due within 30d'
         when so.delivery_date::date <= current_date + 90      then 'due 30-90d'
         else                                                       'due > 90d'
       end                                                   as bucket,
       count(*)                                              as open_orders,
       round(sum(so.total_amount_myr))                       as value_myr,
       round(100.0 * sum(so.total_amount_myr)
             / sum(sum(so.total_amount_myr)) over (), 1)     as pct_of_book
from public.sap_sales_orders so
where so.is_cancelled = 'N'
  and so.status_code  = 'O'
group by 1
order by value_myr desc;
