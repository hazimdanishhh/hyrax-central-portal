-- ############################################################################
-- v_sales_monthly_series -- the one definition of the three O2C measures
--
-- Step 3 of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. No table, no write path.
--
-- Everything downstream -- decomposition, baselines, backtest, the projection
-- itself, and the actual-vs-expected join -- reads this and only this. Define
-- the series once or the dashboard will eventually disagree with itself.
--
-- THE FILTERS ARE COPIED, NOT RE-DERIVED
--
-- Each branch below reproduces the corresponding CTE in
-- get_sales_reports_dashboard_rpc.sql character for character, minus that
-- RPC's own v_sales_rep_code parameter (this series is company-wide):
--
--   orders    <- base_orders        (sap_sales_orders, is_cancelled = 'N')
--   invoiced  <- base_invoices      (sap_invoices,     is_cancelled = 'N')
--   collected <- base_payment_apps  (the RCT2 -> ORCT -> OINV chain)
--
-- If these drift, the fan chart's history leg will disagree with the
-- "Invoiced Revenue" tile sitting directly above it on the same page, and
-- nobody will be able to tell which one is right.
--
-- THREE TRAPS, all documented in hyrax-data-platform/docs/data-dictionary.md
--
--   1. Every SAP date column is `text`. Cast with ::date. No exceptions.
--   2. sap_payment_applications has NO DATE OF ITS OWN. It dates through
--      payment_ref -> sap_payments.doc_entry -> payment_date. The join column
--      is payment_ref, NOT receipt_number -- the RCT2 Join Trap, which is
--      dangerous precisely because it used to work: both columns held the same
--      value until a new SAP numbering series on 2024-12-20 split them.
--   3. inv_type = 13 is the only enforcement of a polymorphic FK; there is no
--      DB-level constraint. Rows of other types will never match an invoice,
--      by design, not by data-quality bug.
--
-- WHY A GENERATE_SERIES SPINE
--
-- Phase 0 found no calendar gaps in the usable range, but every downstream
-- method leans on lag(value, 12), and lag() counts ROWS, not months. A single
-- absent month silently shifts the entire seasonal baseline by one position
-- and nothing errors. The spine makes a zero-activity month an explicit zero
-- instead of an absent row, so that failure becomes impossible rather than
-- merely unobserved.
--
-- WHY THE SERIES STARTS 2017-11
--
-- Measured 2026-10-02 (see SALES-PROJECTIONS-ARCHITECTURE.md §11): sap_invoices
-- reaches back to 2011, but 2011 holds ONE invoice, 2013 three, 2014 six, and
-- 2015/2016 ten months each totalling RM260k and RM2.6M against RM42.4M in
-- 2017. That is a partial SAP rollout, not a business. orders and collected
-- both genuinely begin 2017-11, so that is where all three align.
--
-- is_complete EXCLUDES THE CURRENT MONTH
--
-- The current month is always partial -- on the 1st it holds a few hours of
-- trading. Phase 0's own concentration test read 99.8% for a 4-invoice October
-- for exactly this reason. Every analytical view downstream filters on
-- is_complete; only the chart's history leg should ever show the partial month.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- ############################################################################

create or replace view public.v_sales_monthly_series
with (security_invoker = on) as

with bounds as (
    select date '2017-11-01'                         as series_start,
           date_trunc('month', current_date)::date   as series_end
),

-- One row per (measure, month) across the whole range, regardless of activity.
spine as (
    select m.measure,
           gs::date as period_month
    from (values ('orders'), ('invoiced'), ('collected')) as m(measure)
    cross join bounds b
    cross join lateral generate_series(b.series_start, b.series_end, interval '1 month') as gs
),

observed as (
    -- ORDERS -- mirrors base_orders
    select 'orders'::text                                   as measure,
           date_trunc('month', so.order_date::date)::date   as period_month,
           sum(so.total_amount_myr)                         as value,
           count(*)                                         as doc_count
    from public.sap_sales_orders so
    where so.is_cancelled = 'N'
    group by 1, 2

    union all

    -- INVOICED -- mirrors base_invoices
    select 'invoiced',
           date_trunc('month', oi.invoice_date::date)::date,
           sum(oi.total_amount_myr),
           count(*)
    from public.sap_invoices oi
    where oi.is_cancelled = 'N'
    group by 1, 2

    union all

    -- COLLECTED -- mirrors base_payment_apps.
    -- The cancelled-invoice guard must LEFT JOIN raw sap_invoices, never a
    -- pre-filtered relation: against a cancel-filtered source a cancelled
    -- invoice's i.doc_entry comes back null too, and the `is null or` form
    -- would then incorrectly KEEP the row instead of excluding it.
    select 'collected',
           date_trunc('month', p.payment_date::date)::date,
           sum(pa.amount_applied_myr),
           count(*)
    from public.sap_payment_applications pa
    join public.sap_payments p
      on pa.payment_ref = p.doc_entry
    left join public.sap_invoices i
      on pa.doc_entry = i.doc_entry
     and pa.inv_type  = 13
    where p.is_cancelled = 'N'
      and (i.doc_entry is null or i.is_cancelled = 'N')
    group by 1, 2
)

select s.measure,
       s.period_month,
       coalesce(o.value, 0)::numeric                        as value,
       coalesce(o.doc_count, 0)::bigint                     as doc_count,
       (s.period_month < (select series_end from bounds))   as is_complete
from spine s
left join observed o
       on o.measure      = s.measure
      and o.period_month = s.period_month;


comment on view public.v_sales_monthly_series is
    'Canonical monthly O2C series (orders/invoiced/collected) from 2017-11. '
    'Gap-free via generate_series spine. Filters copied verbatim from '
    'get_sales_reports_dashboard_rpc.sql. is_complete = false for the current, '
    'partial month -- analytical consumers must filter on it.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_step3_verification.sql
-- Run them one at a time, after this file has succeeded.
