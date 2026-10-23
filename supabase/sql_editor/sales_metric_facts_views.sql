-- ############################################################################
-- sales_metric_facts_views.sql -- LAYER 1 of the Sales Reports metric layer.
-- See docs/sales/SALES-REPORTS-TABS-PLAN.md §4.
--
-- One view per business fact. THIS FILE IS WHERE EACH SALES MEASURE IS
-- DEFINED: which documents count (cancelled ones never do), which date a fact
-- belongs to, which salesperson it belongs to, and which amount is "the"
-- amount. Report RPCs read these views (through sales_metric_functions.sql),
-- never the raw sap_* / sales_* tables, so a measure called "Invoiced" or
-- "Collected" is computed exactly one way on every tab and every page.
--
-- Change a definition HERE, never in an RPC. Every change shows up in
-- tests/sql/sales_metrics.test.js.
--
-- Conventions:
--   * security_invoker = on, like every view in this repo: the caller's own
--     table RLS applies, so these grant no access the tables don't already.
--     The report RPCs keep their own access guard (sales_report_scope) because
--     several underlying tables have no RLS.
--   * SAP stores dates as text. Each is cast to `date` ONCE, here, behind
--     nullif(x, '') -- a bare ''::date raises 22007 and fails the whole query.
--   * Amounts are MYR. Header amounts are SAP's system-currency total
--     (DocTotalSy, total_amount_myr) and INCLUDE tax -- decision D4 in the
--     plan is still open; sap_invoices.tax_amount (VatSum) exists for when it
--     is decided. Line amounts are before tax and say so in their name.
--
-- Run order: this file, then sales_metric_functions.sql. Re-runnable.
-- ############################################################################


-- ─── Invoiced revenue ───────────────────────────────────────────────────────
-- One row per A/R invoice that is not cancelled. "Invoiced Revenue" everywhere
-- = sum(invoiced_myr), dated by invoice_date, owned by the invoice's sales rep.
--
-- customer_name comes from the customer master, falling back to the invoice's
-- own CardName: CardName can differ between documents for one customer code,
-- and grouping by it split one customer into several rows (audit D6).
--
-- gross_profit_myr is SAP's GrosProfit with the outlier guard every dashboard
-- here applies (get_finance_dashboard's rule): SAP's item-cost master data has
-- a known defect at the extremes, so a GP more than 5x the invoice total is
-- treated as unknown (null) rather than summed.
create or replace view public.sales_invoice_facts
with (security_invoker = on) as
select
    i.doc_entry,
    nullif(i.invoice_date, '')::date as invoice_date,
    i.customer_code,
    coalesce(sc.customer_name, i.customer_name) as customer_name,
    sc.local_export_flag,
    i.sales_rep_code,
    i.total_amount_myr as invoiced_myr,
    case
        when i.total_amount_myr <> 0
         and abs(i.gross_profit) > abs(i.total_amount_myr) * 5
        then null
        else i.gross_profit
    end as gross_profit_myr,
    -- Document-currency -> MYR factor for this invoice's LINES, whose
    -- line_total is in document currency (same derivation as the old RPC's
    -- base_invoice_lines.doc_myr_ratio).
    case
        when i.total_amount <> 0 then i.total_amount_myr / i.total_amount
        else 1
    end as doc_myr_ratio,
    -- Invoiced revenue BEFORE tax: the base Gross Margin divides by, since
    -- SAP's GrosProfit is net of tax. VatSum (tax_amount) and GrosProfit are
    -- both in SAP's local currency, which at Hyrax IS MYR (local = system
    -- currency, confirmed in hyrax-data-platform/docs/data-dictionary.md), so
    -- the subtraction mixes no currencies. Appended last: CREATE OR REPLACE
    -- VIEW can only add columns at the end.
    i.total_amount_myr - coalesce(i.tax_amount, 0) as invoiced_before_tax_myr
from public.sap_invoices i
left join public.sap_customers sc on sc.customer_code = i.customer_code
where i.is_cancelled = 'N';


-- ─── Product sales (invoice lines, BEFORE tax) ──────────────────────────────
-- One row per line of a non-cancelled invoice. Line totals exclude tax and
-- header-level discount/freight, so these never add up to Invoiced Revenue:
-- that is why the measure is called product sales (before tax), never
-- "revenue", until decision D4 settles one basis for both.
create or replace view public.sales_invoice_line_facts
with (security_invoker = on) as
select
    il.doc_entry,
    il.line_num,
    f.invoice_date,
    f.customer_code,
    f.sales_rep_code,
    il.item_code,
    case
        when coalesce(nullif(it.inventory_uom, ''), nullif(it.sales_uom, '')) is not null
        then coalesce(it.item_name, il.item_code) || ' - ('
             || coalesce(nullif(it.inventory_uom, ''), it.sales_uom) || ')'
        else coalesce(it.item_name, il.item_code)
    end as item_name,
    coalesce(ig.group_name, 'Ungrouped') as item_group_name,
    il.quantity,
    il.line_total * f.doc_myr_ratio as line_before_tax_myr
from public.sap_invoice_lines il
join public.sales_invoice_facts f on f.doc_entry = il.doc_entry
left join public.sap_items it on it.item_code = il.item_code
left join public.sap_item_groups ig on ig.group_code = it.item_group_code;


-- ─── Orders booked ──────────────────────────────────────────────────────────
-- One row per sales order that is not cancelled. "Orders Booked" = sum of
-- booked_myr, dated by order_date, owned by the order's sales rep.
create or replace view public.sales_order_facts
with (security_invoker = on) as
select
    o.doc_entry,
    nullif(o.order_date, '')::date as order_date,
    o.customer_code,
    o.sales_rep_code,
    o.total_amount_myr as booked_myr
from public.sap_sales_orders o
where o.is_cancelled = 'N';


-- ─── Payments collected ─────────────────────────────────────────────────────
-- One row per payment application (RCT2) that settles a non-cancelled A/R
-- invoice from a non-cancelled receipt. "Payments Collected" = sum of
-- applied_myr, dated by the RECEIPT's payment_date, owned by the INVOICE's
-- sales rep.
--
-- The joins are the definition:
--   * RCT2 -> ORCT via payment_ref = sap_payments.doc_entry, never
--     receipt_number (the documented "RCT2 join trap").
--   * RCT2 -> OINV via doc_entry with inv_type = 13 (A/R invoice). doc_entry
--     is polymorphic, and nothing in the database enforces that filter.
--   * INNER join to the invoice: cash not applied to an A/R invoice
--     (on-account cash, other document types) is not "collected" for Sales.
--     This replaces `invoice_sales_rep_code is not null`, which also dropped
--     cash on real invoices that simply have no rep (audit D2).
--
-- One receipt can settle several invoices, so it spans several rows: count
-- payments with count(distinct payment_doc_entry), never count(*) (audit D8).
create or replace view public.sales_collection_facts
with (security_invoker = on) as
select
    p.doc_entry as payment_doc_entry,
    nullif(p.payment_date, '')::date as payment_date,
    i.doc_entry as invoice_doc_entry,
    i.customer_code,
    coalesce(sc.customer_name, i.customer_name) as customer_name,
    i.sales_rep_code,
    pa.amount_applied_myr as applied_myr
from public.sap_payment_applications pa
join public.sap_payments p on p.doc_entry = pa.payment_ref
join public.sap_invoices i on i.doc_entry = pa.doc_entry and pa.inv_type = 13
left join public.sap_customers sc on sc.customer_code = i.customer_code
where p.is_cancelled = 'N'
  and i.is_cancelled = 'N';


-- ─── Receivables (open balances, as of TODAY) ───────────────────────────────
-- One row per invoice still owed right now, by FINANCE's rule
-- (get_invoices_overview_rpc.sql, the Finance -> Invoices page): not
-- cancelled, still open in SAP (status O), and owing more than RM0.01. Until
-- 2026-10-23 Sales dropped the status check, so its Outstanding could
-- disagree with Finance's for the same rep; one rule now.
-- outstanding_balance comes from sap_invoices_with_balance, which accounts for
-- payments applied at any time since the invoice was raised.
--
-- days_past_due  today - due date (<= 0 not yet due; null with no due date).
--                Finance's thresholds read it: overdue > 0, critically
--                overdue > 90, aging buckets 1-30 / 31-60 / 61-90 / 90+.
create or replace view public.sales_receivable_facts
with (security_invoker = on) as
select
    b.doc_entry,
    nullif(b.invoice_date, '')::date as invoice_date,
    b.customer_code,
    coalesce(sc.customer_name, b.customer_name) as customer_name,
    b.sales_rep_code,
    b.outstanding_balance as outstanding_myr,
    nullif(b.due_date, '')::date as due_date,
    current_date - nullif(b.due_date, '')::date as days_past_due
from public.sap_invoices_with_balance b
left join public.sap_customers sc on sc.customer_code = b.customer_code
where b.is_cancelled = 'N'
  and b.status_code = 'O'
  and b.outstanding_balance > 0.01;


-- ─── Leads (CRM): every lead, with its outcome ──────────────────────────────
-- One row per lead. The Pipeline tab's measures all come from here, and
-- sales_won_lead_facts below is just its 'won' rows -- so "Won" has one
-- definition whether it appears on Summary or Pipeline.
--
-- outcome (one rule, matching Leads Overview's own lost definition):
--   'won'   stage WON and not cancelled
--   'lost'  stage LOST, OR cancelled at any stage -- a deal called off is a
--           deal not won (decision D5: a cancelled WON lead counts here,
--           never as won revenue)
--   'open'  anything else
--
-- closed_on: when a won/lost lead closed -- its last WON/LOST transition in
-- sales_leads_stage_history, falling back to updated_at (same rule as
-- before) -- taken as a date in MALAYSIA time. The timestamps are
-- timestamptz, and a UTC date put a deal won at 07:00 on the 1st into the
-- previous month (audit D12, decision D7). Null for open leads.
--
-- lost_reason: the lose reason, "Cancelled" for a cancelled lead, or "No
-- reason given". Null unless lost.
--
-- expected_myr / close_probability: what an OPEN deal is expected to bring
-- and how likely (the open pipeline and its weighted value). won_myr: what a
-- won deal actually brought (null unless won).
--
-- pending_sap_order (2026-10-23): a won lead whose PO number no SAP sales
-- order carries yet (sap_sales_orders.customer_ref = po_number) -- the
-- sales admin still has to enter it. The SAME test as
-- sales_leads_with_closed_date.pending_sap_order (Leads list / Leads
-- Overview), restated rather than read from that view: hyrax-data-platform
-- drops and recreates that view, which a dependent view would block. One
-- difference, on purpose: only WON-and-not-cancelled leads count, matching
-- this layer's Won; the report links to the list with cancelled=false so
-- the list shows the same leads.
create or replace view public.sales_lead_facts
with (security_invoker = on) as
with closing as (
    select lead_id, max(changed_at) as closed_at
    from public.sales_leads_stage_history
    where new_stage in ('WON', 'LOST')
    group by lead_id
),
classified as (
    select
        sl.*,
        case
            when sl.is_cancelled or sl.stage = 'LOST' then 'lost'
            when sl.stage = 'WON' then 'won'
            else 'open'
        end as outcome
    from public.sales_leads sl
)
select
    sl.id as lead_id,
    sl.outcome,
    sl.stage::text as stage,
    sl.is_on_hold,
    (sl.created_at at time zone 'Asia/Kuala_Lumpur')::date as created_on,
    case when sl.outcome <> 'open' then
        (coalesce(c.closed_at, sl.updated_at) at time zone 'Asia/Kuala_Lumpur')::date
    end as closed_on,
    sl.lead_owner_id as owner_employee_id,
    coalesce(sl.client_id::text, sl.sap_customer_code) as account_key,
    coalesce(cl.name, sc.customer_name) as account_name,
    sl.product_type,
    sl.lead_source_type_id,
    coalesce(lst.name, 'Unspecified') as lead_source,
    case when sl.outcome = 'lost' then
        case when sl.is_cancelled then 'Cancelled' else coalesce(lr.name, 'No reason given') end
    end as lost_reason,
    sl.expected_revenue as expected_myr,
    sl.close_probability,
    case when sl.outcome = 'won' then sl.actual_revenue end as won_myr,
    -- appended last (CREATE OR REPLACE VIEW adds columns only at the end)
    sl.po_number,
    coalesce(
        sl.outcome = 'won'
        and sl.po_number is not null
        and not exists (
            select 1 from public.sap_sales_orders sso
            where sso.customer_ref = sl.po_number
        ),
        false) as pending_sap_order
from classified sl
left join closing c on c.lead_id = sl.id
left join public.clients cl on cl.id = sl.client_id
left join public.sap_customers sc on sc.customer_code = sl.sap_customer_code
left join public.lead_source_types lst on lst.id = sl.lead_source_type_id
left join public.sales_leads_lose_reasons lr on lr.id = sl.lose_reason_id;


-- ─── Won deals (CRM) ────────────────────────────────────────────────────────
-- The 'won' rows of sales_lead_facts. "Won" = sum of won_myr, dated by
-- closed_on (Malaysia time), owned by the lead owner (an employee, not a SAP
-- rep code -- the CRM side of the salesperson filter). Cancelled leads are
-- never here (decision D5). Leads Overview's RPC must adopt the same rule
-- when it moves onto these views (plan §6 step 5).
create or replace view public.sales_won_lead_facts
with (security_invoker = on) as
select
    lead_id,
    closed_on,
    owner_employee_id,
    account_key,
    account_name,
    product_type,
    lead_source_type_id,
    won_myr
from public.sales_lead_facts
where outcome = 'won';


-- ─── Order book (open orders, current backlog) ──────────────────────────────
-- One row per sales order that is not cancelled, with the Orders page's own
-- fulfilment flags -- the SAME rules get_fulfillment_overview uses for its
-- Open Backlog / Overdue / Delivered-Not-Invoiced tiles, so the report's
-- order book and the Orders page agree:
--   is_open                 still open in SAP (status O) and not fully
--                           delivered. A manually closed order with leftover
--                           quantity is a decision to stop, not backlog.
--   is_overdue              open, and its delivery date has passed
--   delivered_not_invoiced  fully delivered, no invoice by either route --
--                           no status gate: a closed, delivered, unbilled
--                           order is still a billing gap
-- order_value_myr is the FULL order value (the view rolls up quantities, not
-- open line value) -- same as the Orders page's backlog value.
create or replace view public.sales_order_book_facts
with (security_invoker = on) as
select
    f.doc_entry,
    nullif(f.order_date, '')::date as order_date,
    nullif(f.delivery_date, '')::date as delivery_date,
    f.customer_code,
    f.sales_rep_code,
    f.total_amount_myr as order_value_myr,
    f.status_code = 'O' and not f.is_fully_delivered as is_open,
    -- coalesce: an order with no delivery date is not known to be late
    coalesce(f.status_code = 'O' and not f.is_fully_delivered
        and nullif(f.delivery_date, '')::date < current_date, false) as is_overdue,
    f.is_fully_delivered and f.matched_invoice_count = 0 as delivered_not_invoiced
from public.sap_sales_orders_with_fulfillment f
where f.is_cancelled = 'N';

-- Plans (sales_budgets per SAP rep, sales_targets per lead owner) have no
-- view: they are already one clean row per rep/owner per month. Their one
-- rule -- spreading a monthly amount over any date range -- is
-- prorate_months() in sales_metric_functions.sql.


-- ─── Grants ─────────────────────────────────────────────────────────────────
-- Supabase's default privileges hand every new object in `public` to anon;
-- take that back explicitly. Signed-in users read through these views with
-- their own table permissions (security_invoker).
revoke all on
    public.sales_invoice_facts,
    public.sales_invoice_line_facts,
    public.sales_order_facts,
    public.sales_collection_facts,
    public.sales_receivable_facts,
    public.sales_won_lead_facts,
    public.sales_lead_facts,
    public.sales_order_book_facts
from anon;

grant select on
    public.sales_invoice_facts,
    public.sales_invoice_line_facts,
    public.sales_order_facts,
    public.sales_collection_facts,
    public.sales_receivable_facts,
    public.sales_won_lead_facts,
    public.sales_lead_facts,
    public.sales_order_book_facts
to authenticated;
