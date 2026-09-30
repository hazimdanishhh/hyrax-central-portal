create or replace function get_sales_reports_dashboard(
    p_start_date   date default null,
    p_end_date     date default null,
    p_owner_id     uuid default null,
    p_product_type public.product_type default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    -- Resolved/overridable copy of p_owner_id -- see the access guard below,
    -- which forces this to the caller's own employee id for a staff-role
    -- caller, and the sales_rep_code resolution right after it, which every
    -- SAP-sourced base CTE now filters on. Every reference to the CRM owner
    -- filter further down in this function reads v_owner_id, never the raw
    -- p_owner_id parameter, so the staff self-scope override actually takes
    -- effect everywhere (CRM AND SAP sides), not just on the SAP side.
    v_owner_id uuid := p_owner_id;
    v_sales_rep_code bigint;
    v_caller_role text;
    v_caller_department text;
    v_caller_employee_id uuid;
    -- KPI-cards restructuring (2026-09-30) -- REGULAR family's effective
    -- range + previous-period calc, mirrors get_attendance_dashboard_rpc.sql/
    -- get_hr_employees_dashboard_rpc.sql's own fix exactly: defaults to the
    -- FULL current month (never month-to-date) when unfiltered, uniform
    -- across every REGULAR KPI on this page. Trend-shaped chart datasets
    -- (realizedVsPipelineData, invoicedVsBudgetTrendData, stageData,
    -- productTypeData, sourceData, topClientsData) deliberately keep reading
    -- the RAW p_start_date/p_end_date (all-time when unset) -- charts are a
    -- separate, later pass, and a multi-point trend forced to "This Month"
    -- would collapse to a single meaningless point the same way it would
    -- have on Employee Overview's Headcount Trend.
    v_effective_start_date date;
    v_effective_end_date date;
    v_prev_start_date date;
    v_prev_end_date date;
    v_interval integer;
    -- ACTIONABLE family (Sales Order Health, new card) -- true current
    -- backlog when unfiltered, narrows to "originated this period" once a
    -- range is explicitly picked. Same v_has_period pattern as Attendance/
    -- Employee Overview's own actionable tiles.
    v_has_period boolean;
    -- Sales Order Health's own 4 cohorts, pre-computed once via a plain
    -- if/else (not a CTE referenced from a `case when v_has_period` branch)
    -- for the identical reason those other RPCs' actionable pre-computations
    -- exist: avoid ever scanning sap_sales_orders_with_fulfillment both
    -- unbounded AND period-bound on the same call.
    v_overdue_deliveries_count bigint;
    v_delivery_due_soon_count bigint;
    v_payment_mismatches_count bigint;
    v_not_yet_invoiced_count bigint;
    -- The card's own headline -- a true DISTINCT-order union of the 4
    -- cohorts above, not a client-side sum of them (an order can be BOTH
    -- overdue AND payment-mismatched at once, so summing would double-count
    -- it). Computed server-side for the same reason Employee Overview's
    -- dataGapsCount is its own separate query rather than a sum of its own
    -- overlapping sub-metrics.
    v_needs_attention_count bigint;
begin

-- Sales Reports (Tier 3) -- department-level synthesis, distinct from Leads
-- Overview's Tier-2 daily rep-coaching cadence. See
-- hyrax-central-portal/docs/DASHBOARD-CONVENTIONS.md §1.
--
-- Surfaces BOTH sales forecasts side by side, never blended into one number
-- (per hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.2):
--   Forecast 1 "Pipeline Target" -- CRM self-reported, sales_targets vs
--     sales_leads.actual_revenue, keyed by lead_owner_id (employees.id).
--   Forecast 2 "Invoice Budget"  -- SAP system-of-record, sales_budgets vs
--     sap_invoices.total_amount_myr, keyed by sales_rep_code. employees/
--     profiles are joined in ONLY to resolve a display name/avatar, via the
--     employee_sales_rep_mapping bridge table (employees.id <->
--     sales_rep_code, auto-created per SAP rep by a trigger -- see
--     docs/DASHBOARD-ROADMAP.md §1.1) -- NOT employees.employee_id =
--     sap_sales_persons.employee_id (EmpID), which is confirmed broken
--     (type mismatch, empty in production, wrong conceptual target).
--
-- KPI-cards restructuring (2026-09-30, see DASHBOARD-CONVENTIONS.md §4b/§4c
-- and get_attendance_dashboard_rpc.sql for the reference convention this
-- migrates onto): 8 tiles, down from 8 -- same count, fully rethought
-- content. 4 old Leads/Pipeline tiles (Leads VS Target, Leads Pipeline
-- Health, Leads Win Rate, Sales Leads Cycle) fold into ONE "Leads vs Target"
-- card. Two real calculation findings fixed along the way (both raised
-- directly by the user while reviewing this file):
--   1. Payments Collected was counting cash NOT resolved against any real
--      sales invoice (on-account cash, other SAP doc types) in the
--      company-wide total -- collected_kpis below now requires
--      invoice_sales_rep_code is not null, same signal
--      rep_collected_actuals already used, just enforced one level up.
--      Deliberately NOT also surfacing that excluded cash as an
--      "Unattributed Cash" metric here -- it's Finance's own reconciliation
--      concern, not something a Sales report needs to show.
--   2. Invoiced Revenue still has NO sales-order<->invoice document join
--      (confirmed structurally -- sap_sales_orders/sap_invoices share no
--      key anywhere in this RPC), so a company-wide (unfiltered) read can
--      include an invoice with a null sales_rep_code. Left as-is, not
--      silently excluded -- whether SAP ever legitimately leaves a real
--      sale's sales_rep_code null needs a live check against
--      hyrax-data-platform before deciding either way.
-- New Sales Order Health card (ACTIONABLE) reads
-- sap_sales_orders_with_fulfillment -- the SAME view/columns
-- (is_fully_delivered/delivery_date/has_paid_mismatch/matched_invoice_count)
-- the Sales Orders list page's own deliveryOverdueOnly/deliveryDueSoonOnly/
-- hasMismatchOnly/invoicedOnly filters already use
-- (fulfillmentOrdersService.js), so this tile's counts can never disagree
-- with what those filters return on the list.

-- ─── Access guard (added 2026-08) ──────────────────────────────────────
-- This RPC has SECURITY INVOKER (the default) and reads tables with no RLS
-- at all today (sap_*, sales_leads, sales_budgets -- see
-- supabase/access-control/table_access_matrix.csv). Without this guard, any
-- authenticated user calling get_sales_reports_dashboard directly --
-- bypassing the frontend's AccessRoute(departments:["SAL","MGM"],
-- roles:["manager"]) gate entirely -- would get back full, unfiltered,
-- company-wide data. Mirrors get_finance_dashboard_rpc.sql's own guard of
-- the same shape (added for the same reason -- its GL source is a
-- materialized view, which can't have RLS at all).
--
-- A staff-role caller is force-scoped to their own data (v_owner_id
-- overridden below, ignoring whatever p_owner_id was actually passed) --
-- this is currently unreachable from the frontend (sales/reports stays
-- manager-gated), but is the foundation a future self-service surface plugs
-- into without any further RPC change. See docs/DASHBOARD-ROADMAP.md's
-- Sales Reports section for the deferred frontend work this sets up.
select r.name, d.sub, e.id
  into v_caller_role, v_caller_department, v_caller_employee_id
from profiles p
join roles r on r.id = p.role_id
join departments d on d.id = p.department_id
left join employees e on e.profile_id = p.id
where p.id = auth.uid();

if v_caller_role is null then
    raise exception 'Access denied';
end if;

if v_caller_role <> 'superadmin' then
    if v_caller_department not in ('SAL', 'MGM') then
        raise exception 'Access denied';
    end if;
    if v_caller_role = 'staff' then
        v_owner_id := v_caller_employee_id;
    end if;
end if;

-- Resolve the CRM owner (employees.id) to a SAP sales_rep_code ONCE, via the
-- same employee_sales_rep_mapping bridge invoiceBudgetScorecardData already
-- joins for display below -- every SAP-sourced base CTE (base_invoices/
-- base_orders/base_payment_apps/budget_math) filters on v_sales_rep_code, so
-- selecting a Salesperson on the frontend now scopes SAP data the same way
-- it already scoped CRM data, instead of only the latter.
if v_owner_id is not null then
    select m.sales_rep_code into v_sales_rep_code
    from employee_sales_rep_mapping m
    where m.employee_id = v_owner_id;
end if;

-- FIXED 2026-08 (real fail-open bug, found during Sales Reports
-- restructuring research): every predicate below reads "v_sales_rep_code is
-- null or x = v_sales_rep_code", which was written to mean "unfiltered" when
-- NO owner is selected. But if an owner IS selected and simply has no
-- employee_sales_rep_mapping row with employee_id set (a real, still
-- manual-only state -- see DASHBOARD-ROADMAP.md 1.1), the select above
-- leaves v_sales_rep_code NULL too -- so that same "is null" branch
-- silently meant "unfiltered" here as well, returning every company
-- invoice/order/payment/budget while the CRM side stayed correctly scoped
-- to the one selected owner. Fail-open, not fail-closed. Force a sentinel
-- that can never match a real sales_rep_code (SAP SlpCode is never
-- negative) so an unmapped owner correctly gets zero SAP rows instead of
-- everyone's -- every downstream predicate needs no change, since they
-- already compare against v_sales_rep_code as-is.
if v_owner_id is not null and v_sales_rep_code is null then
    v_sales_rep_code := -1;
end if;

-- Effective range for REGULAR metrics + previous-period calc (2026-09-30) --
-- see this variable's own declaration comment above.
v_effective_start_date := coalesce(p_start_date, date_trunc('month', current_date)::date);
v_effective_end_date := coalesce(p_end_date, (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date);

v_interval := v_effective_end_date - v_effective_start_date;
v_prev_end_date := v_effective_start_date - 1;
v_prev_start_date := v_prev_end_date - v_interval;

-- ACTIONABLE family (Sales Order Health) -- see this variable's own
-- declaration comment above.
v_has_period := (p_start_date is not null and p_end_date is not null);

-- Sales Order Health pre-computation -- see v_overdue_deliveries_count's own
-- declaration comment above. p_product_type is deliberately NOT applied here
-- -- same existing asymmetry every other SAP-sourced field on this page
-- already has (p_product_type only ever filters base_leads).
-- delivery_date is stored as text on sap_sales_orders (same reason
-- order_date/invoice_date need an explicit ::date cast everywhere else in
-- this file) -- every comparison below casts it, matching
-- fulfillmentOrdersService.js's own toLocalDateString(...) string comparisons
-- against this same column.
if v_has_period then
    select
        count(*) filter (where not is_fully_delivered and delivery_date::date < current_date),
        count(*) filter (where not is_fully_delivered and delivery_date::date >= current_date and delivery_date::date <= current_date + interval '7 days'),
        count(*) filter (where has_paid_mismatch),
        count(*) filter (where matched_invoice_count = 0),
        count(*) filter (where
            (not is_fully_delivered and delivery_date::date < current_date)
            or (not is_fully_delivered and delivery_date::date >= current_date and delivery_date::date <= current_date + interval '7 days')
            or has_paid_mismatch
            or matched_invoice_count = 0
        )
    into
        v_overdue_deliveries_count, v_delivery_due_soon_count,
        v_payment_mismatches_count, v_not_yet_invoiced_count,
        v_needs_attention_count
    from sap_sales_orders_with_fulfillment
    where is_cancelled = 'N'
      and (v_sales_rep_code is null or sales_rep_code = v_sales_rep_code)
      and "order_date"::date >= p_start_date
      and "order_date"::date <= p_end_date;
else
    select
        count(*) filter (where not is_fully_delivered and delivery_date::date < current_date),
        count(*) filter (where not is_fully_delivered and delivery_date::date >= current_date and delivery_date::date <= current_date + interval '7 days'),
        count(*) filter (where has_paid_mismatch),
        count(*) filter (where matched_invoice_count = 0),
        count(*) filter (where
            (not is_fully_delivered and delivery_date::date < current_date)
            or (not is_fully_delivered and delivery_date::date >= current_date and delivery_date::date <= current_date + interval '7 days')
            or has_paid_mismatch
            or matched_invoice_count = 0
        )
    into
        v_overdue_deliveries_count, v_delivery_due_soon_count,
        v_payment_mismatches_count, v_not_yet_invoiced_count,
        v_needs_attention_count
    from sap_sales_orders_with_fulfillment
    where is_cancelled = 'N'
      and (v_sales_rep_code is null or sales_rep_code = v_sales_rep_code);
end if;

with closing_dates as (
    select lead_id, max(changed_at) as closed_date
    from sales_leads_stage_history
    where new_stage in ('WON', 'LOST')
    group by lead_id
),

base_leads as (
    select
        sl.*,
        coalesce(cd.closed_date, case when sl.stage in ('WON', 'LOST') or sl.is_cancelled then sl.updated_at else null end) as closed_date,
        -- Account identity (2026-08): a lead references exactly one of a
        -- real SAP customer (sap_customer_code) or a native Prospect
        -- (client_id), never both -- see
        -- sales_leads_sap_customer_link_migration.sql. Computed once here so
        -- topClientsData below can treat both cases uniformly.
        coalesce(sl.client_id::text, sl.sap_customer_code) as account_key,
        coalesce(c.name, sc.customer_name) as account_name
    from sales_leads sl
    left join closing_dates cd on cd.lead_id = sl.id
    left join clients c on c.id = sl.client_id
    left join sap_customers sc on sc.customer_code = sl.sap_customer_code
    where (v_owner_id is null or sl.lead_owner_id = v_owner_id)
      and (p_product_type is null or sl.product_type = p_product_type)
),

-- v_sales_rep_code (resolved above from v_owner_id via
-- employee_sales_rep_mapping) scopes this CTE -- every downstream consumer
-- (rep_invoice_actuals, invoice_kpis, invoiceBudgetScorecardData,
-- grossProfitByRepData, top_invoiced_customers, bookingsVsInvoicedTrendData,
-- invoicedVsBudgetTrendData, and base_invoice_lines below) reads FROM this
-- CTE rather than re-querying sap_invoices directly, so they all inherit the
-- filter for free instead of needing their own predicate.
base_invoices as (
    select oi.*
    from sap_invoices oi
    where oi.is_cancelled = 'N'
      and (v_sales_rep_code is null or oi.sales_rep_code = v_sales_rep_code)
),

-- Same v_sales_rep_code scoping as base_invoices above -- rep_order_actuals,
-- order_book_kpi, orderBookData, and bookingsVsInvoicedTrendData all read
-- FROM this CTE.
base_orders as (
    select so.*
    from sap_sales_orders so
    where so.is_cancelled = 'N'
      and (v_sales_rep_code is null or so.sales_rep_code = v_sales_rep_code)
),

-- Cash collected (added 2026-07, invoice/budget/collected rebalance) -- the
-- RCT2 -> ORCT -> OINV chain, copied from get_finance_dashboard_rpc.sql's own
-- base_payment_apps rather than re-derived, so the two dashboards can never
-- report a different collected figure for the same window (same mirroring
-- rationale as pipeline_target_math below). Closes this page's biggest
-- structural gap: it tracked Sales Order -> Invoice -> Budget but never
-- whether invoiced revenue was actually COLLECTED.
--
-- Adapted to this RPC's own conventions, two deliberate differences from
-- Finance's copy: (1) is_cancelled = 'N' literal, matching base_invoices/
-- base_orders above -- this RPC has no p_is_cancelled parameter; (2) no
-- p_customer_code/p_sales_rep_code predicates -- those parameters don't
-- exist on this function.
--
-- `i.customer_code` added (2026-09-30) -- needed for the new
-- distinctCustomersPaid KPI sub-metric (Payments Collected card); previously
-- this CTE only carried what collected_kpis/rep_collected_actuals needed.
--
-- THE RCT2 JOIN TRAP: payment_ref -> sap_payments.doc_entry, NOT
-- receipt_number. For receipts through 2024-12-19 the two held the same
-- value (old SAP numbering series), which masked this for years; a new
-- series activated 2024-12-20 made them diverge, silently breaking any
-- receipt_number join since. See hyrax-data-platform/docs/data-dictionary.md's
-- "RCT2 Join Trap" section.
base_payment_apps as (
    select
        pa.amount_applied_myr,
        p.payment_date,
        i.sales_rep_code as invoice_sales_rep_code,
        i.customer_code as invoice_customer_code
    from sap_payment_applications pa
    join sap_payments p on pa.payment_ref = p.doc_entry
    -- doc_entry is the real FK to sap_invoices.doc_entry, but ONLY when
    -- inv_type = 13 (A/R Invoice) -- a polymorphic FK with no DB-level
    -- constraint (deliberately -- see infrastructure/supabase_sap_
    -- migration.sql), so this filter is the only enforcement; don't drop it.
    left join sap_invoices i on pa.doc_entry = i.doc_entry and pa.inv_type = 13
    where p.is_cancelled = 'N'
      -- Never blend cash applied against a since-cancelled invoice into an
      -- active-docs view (mirrors base_invoices' own is_cancelled filter).
      -- Rows with no invoice match at all (i.doc_entry is null -- on-account
      -- cash, other inv_types) are unrelated to invoice cancellation and stay
      -- in either way at THIS level -- collected_kpis below is what actually
      -- excludes them from the Sales-facing total now (2026-09-30 fix, see
      -- this function's own header comment). NOTE: this guard must join raw
      -- sap_invoices, not base_invoices -- a left join to base_invoices would
      -- make a CANCELLED invoice's i.doc_entry come back null too, and the
      -- "i.doc_entry is null or ..." form below would then incorrectly KEEP
      -- it instead of excluding it.
      and (i.doc_entry is null or i.is_cancelled = 'N')
      -- v_sales_rep_code scoping (added 2026-08): when a Salesperson filter
      -- is active, cash that can't be attributed to any invoice at all
      -- (i.doc_entry is null, so i.sales_rep_code is also null) can't be
      -- attributed to THIS rep either -- excluded, same rule
      -- rep_collected_actuals already applies via its own "is not null"
      -- filter, just enforced one level up here so collected_kpis/
      -- invoicedVsBudgetTrendData (which read this CTE dept-wide, not
      -- through rep_collected_actuals) are scoped too.
      and (v_sales_rep_code is null or i.sales_rep_code = v_sales_rep_code)
),

-- Forecast 1: department-wide prorated CRM pipeline target, summed across
-- every rep with a sales_targets row -- same day-overlap proration formula
-- as get_sales_leads_dashboard's scorecardData (mirrored intentionally, so
-- the two dashboards' attainment math never silently drifts apart).
--
-- Switched to v_effective_start_date/v_effective_end_date (2026-09-30) --
-- always a real bound (This Month by default) now, so the old
-- "both-null-means-no-proration" branch is gone: there's always a concrete
-- window to prorate against.
pipeline_target_math as (
    select
        sum(
            t.target_revenue * (
                greatest(0,
                    (least(v_effective_end_date, (t.target_month + interval '1 month' - interval '1 day')::date) -
                    greatest(v_effective_start_date, t.target_month)) + 1
                ) / extract(day from (t.target_month + interval '1 month' - interval '1 day'))
            )
        ) as prorated_target
    from sales_targets t
    where (v_owner_id is null or t.lead_owner_id = v_owner_id)
),

-- Prior-period sibling (2026-09-30), same proration, one period back -- for
-- pipelineAttainmentPct's own subvalue delta.
prev_pipeline_target_math as (
    select
        sum(
            t.target_revenue * (
                greatest(0,
                    (least(v_prev_end_date, (t.target_month + interval '1 month' - interval '1 day')::date) -
                    greatest(v_prev_start_date, t.target_month)) + 1
                ) / extract(day from (t.target_month + interval '1 month' - interval '1 day'))
            )
        ) as prorated_target
    from sales_targets t
    where (v_owner_id is null or t.lead_owner_id = v_owner_id)
),

-- Forecast 2: per-rep prorated invoice budget (identical proration formula,
-- keyed by sales_rep_code instead of lead_owner_id). v_sales_rep_code
-- scoping added 2026-08. Switched to v_effective_* (2026-09-30), same
-- reasoning as pipeline_target_math above.
budget_math as (
    select
        b.sales_rep_code,
        sum(
            b.budget_revenue * (
                greatest(0,
                    (least(v_effective_end_date, (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day')::date) -
                    greatest(v_effective_start_date, date_trunc('month', b.budget_month)::date)) + 1
                ) / extract(day from (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day'))
            )
        ) as prorated_budget
    from sales_budgets b
    where (v_sales_rep_code is null or b.sales_rep_code = v_sales_rep_code)
    group by b.sales_rep_code
),

-- Prior-period sibling (2026-09-30) -- for the dept-wide Revenue Budget
-- total's own attainment delta (Invoiced Revenue card).
prev_budget_math as (
    select
        b.sales_rep_code,
        sum(
            b.budget_revenue * (
                greatest(0,
                    (least(v_prev_end_date, (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day')::date) -
                    greatest(v_prev_start_date, date_trunc('month', b.budget_month)::date)) + 1
                ) / extract(day from (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day'))
            )
        ) as prorated_budget
    from sales_budgets b
    where (v_sales_rep_code is null or b.sales_rep_code = v_sales_rep_code)
    group by b.sales_rep_code
),

-- Switched to v_effective_* (2026-09-30) -- same REGULAR default as every
-- other figure on this page now. Feeds invoiceBudgetScorecardData (Rep
-- Funnel Scorecard, content unchanged, just now defaults to This Month
-- instead of all-time).
rep_invoice_actuals as (
    select
        sales_rep_code,
        coalesce(sum(total_amount_myr), 0) as invoiced_revenue
    from base_invoices
    where "invoice_date"::date >= v_effective_start_date
      and "invoice_date"::date <= v_effective_end_date
    group by sales_rep_code
),

-- Top Products (added 2026-08) -- line-level SAP data behind topProductsData/
-- top_invoiced_products below, the first real "actual sales" product cut on
-- this page (previously the only product cut was sales_leads.product_type, a
-- 3-value CRM enum with no link to a real SKU). Sourced from INV1
-- (billed/invoiced), not RDR1 (booked) -- mirrors this page's existing
-- convention that "Invoice" is always the audited/system-of-record figure
-- (see docs/DASHBOARD-CONVENTIONS.md's Source-labeling table); a "booked"
-- companion from sap_sales_order_lines is a cheap future addition, not built
-- here. Joins base_invoices (not sap_invoices directly), so this inherits
-- BOTH the is_cancelled filter and the v_sales_rep_code scoping above for
-- free.
--
-- Switched to v_effective_* (2026-09-30) -- this CTE now also backs the new
-- Product/Product-Group Concentration KPI cards, not just the topProductsData/
-- revenueByProductGroupData charts, so it follows the same REGULAR default
-- as every other KPI-feeding CTE. (topProductsData/revenueByProductGroupData
-- are simple top-N/composition lists, not multi-point trends, so shifting
-- their default is safe -- unlike the trend-shaped charts this pass leaves
-- alone.)
--
-- sap_invoice_lines.line_total has NO materialized MYR-converted sibling
-- column, unlike its header table (sap_invoices has both total_amount and
-- total_amount_myr) -- confirmed via
-- hyrax-data-platform/ingestion/sap_supabase/src/config.py's INV1_FIELDS
-- mapping (LineTotal -> line_total, Rate -> exchange_rate, no LineTotalSy
-- equivalent).
--
-- FIXED 2026-08 (real reported bug: topProductsData showed real values for
-- some reps, all-zero for others): do NOT multiply by the line's own
-- exchange_rate. SAP Business One is documented to commonly store 0 in the
-- line-level Rate field when a document's currency IS the local/system
-- currency (MYR, true for the large majority of Hyrax's domestic invoices)
-- -- unlike the header's DocRate, which is 1.0 for the same case, with
-- DocTotalSy maintained separately by SAP rather than derived as DocTotal x
-- DocRate (see SAP B1 currency docs -- this diagnosis is corroborated by
-- SAP's own documented behavior and matches the reported symptom exactly,
-- but has not been directly queried against Hyrax's live sap_invoice_lines
-- data). Fix: derive a per-document MYR ratio from the header's own
-- already-correct total_amount/total_amount_myr pair instead -- one
-- invoice has one currency and one effective conversion factor, so this
-- sidesteps needing the line-level Rate field to mean anything at all
-- regardless of the exact live root cause, and guarantees sum(line MYR)
-- reconciles to the header's total_amount_myr by construction (up to
-- rounding), for every document regardless of currency.
base_invoice_lines as (
    select
        il.*,
        case when bi.total_amount <> 0
             then bi.total_amount_myr / bi.total_amount
             else 1
        end as doc_myr_ratio
    from sap_invoice_lines il
    join base_invoices bi on bi.doc_entry = il.doc_entry
    where bi."invoice_date"::date >= v_effective_start_date
      and bi."invoice_date"::date <= v_effective_end_date
),

-- Total line-level invoiced revenue this period (2026-09-30, new) -- the
-- denominator for Product/Product-Group Concentration, from the SAME CTE/
-- window as top_invoiced_products/invoiced_by_product_group below, so those
-- shares are exact, not approximate -- same principle Customer Concentration
-- already established (numerator and denominator both from base_invoices).
total_invoice_line_revenue as (
    select coalesce(sum(line_total * doc_myr_ratio), 0) as total
    from base_invoice_lines
),

-- The company's actual sales-side analysis: PO (sales order) vs Invoice vs
-- Budget variance, per rep -- see invoiceBudgetScorecardData below, which
-- joins this against rep_invoice_actuals/budget_math. Keyed by sales_rep_code
-- (not sales_rep_name, unlike the old orderBookData grouping) so two reps
-- sharing a display name can never collapse into one row.
--
-- Switched to v_effective_* (2026-09-30), same reasoning as
-- rep_invoice_actuals above.
rep_order_actuals as (
    select
        sales_rep_code,
        coalesce(sum(total_amount_myr), 0) as order_value
    from base_orders
    where "order_date"::date >= v_effective_start_date
      and "order_date"::date <= v_effective_end_date
    group by sales_rep_code
),

-- Dept-wide order book (2026-09-30, new -- previously these were inline
-- subqueries directly in the final json_build_object). Same base_orders CTE
-- and window as rep_order_actuals above, so "RM X across N orders" always
-- ties out. distinct_customers is new (Sales Orders card's own
-- "Distinct Customers Ordering" sub-metric).
order_book_kpi as (
    select
        coalesce(sum(total_amount_myr), 0) as order_value,
        count(*) as order_count,
        count(distinct customer_code) as distinct_customers
    from base_orders
    where "order_date"::date >= v_effective_start_date
      and "order_date"::date <= v_effective_end_date
),

-- Prior-period sibling (2026-09-30) -- for orderBookValue's own subvalue
-- delta (no order-level target exists to combine it with, unlike Pipeline/
-- Invoice, so this delta stands alone).
prev_order_book_kpi as (
    select coalesce(sum(total_amount_myr), 0) as order_value
    from base_orders
    where "order_date"::date >= v_prev_start_date
      and "order_date"::date <= v_prev_end_date
),

-- Per-rep cash collected (added 2026-07), same period-bound rule as
-- collected_kpis below -- feeds invoiceBudgetScorecardData's 4th leg.
-- Mirrors get_finance_dashboard_rpc.sql's rep_collected_actuals field for
-- field, so the two dashboards can never report a different collected
-- figure for the same rep and window.
--
-- Reps whose applied cash doesn't resolve to an inv_type = 13 invoice
-- (on-account cash, credit memos, other document types -- see
-- base_payment_apps above) are legitimately absent here. Consequence,
-- expected and NOT a bug: sum(collected_myr) across scorecard rows can be
-- LESS than kpis.totalCollected used to be, though as of the 2026-09-30 fix
-- below the two are now much closer (totalCollected itself also excludes
-- unattributed cash now).
--
-- Switched to v_effective_* (2026-09-30), same reasoning as
-- rep_invoice_actuals above.
rep_collected_actuals as (
    select
        invoice_sales_rep_code as sales_rep_code,
        coalesce(sum(amount_applied_myr), 0) as collected_myr
    from base_payment_apps
    where invoice_sales_rep_code is not null
      and payment_date::date >= v_effective_start_date
      and payment_date::date <= v_effective_end_date
    group by invoice_sales_rep_code
),

-- Dept-wide SAP period totals (added 2026-07) -- the invoice/cash analogue
-- of pipeline_target_math above: single-row aggregates cross-joined into
-- kpis below. Switched to v_effective_* (2026-09-30), same reasoning as
-- rep_invoice_actuals above.
invoice_kpis as (
    select
        coalesce(sum(total_amount_myr) filter (where
            "invoice_date"::date >= v_effective_start_date
            and "invoice_date"::date <= v_effective_end_date
        ), 0) as total_invoiced,

        -- doc_entry is sap_invoices' primary key, so this is exactly
        -- count(*); spelled distinct to match get_finance_dashboard's own
        -- invoice_count idiom.
        count(distinct doc_entry) filter (where
            "invoice_date"::date >= v_effective_start_date
            and "invoice_date"::date <= v_effective_end_date
        ) as invoice_count
    from base_invoices
),

-- Prior-period sibling (2026-09-30) -- for totalInvoiced's own subvalue
-- delta and budgetAttainmentPct's own delta.
prev_invoice_kpis as (
    select
        coalesce(sum(total_amount_myr) filter (where
            "invoice_date"::date >= v_prev_start_date
            and "invoice_date"::date <= v_prev_end_date
        ), 0) as total_invoiced
    from base_invoices
),

collected_kpis as (
    -- Dept-wide. FIXED 2026-09-30 (see this function's own header comment,
    -- finding #1): now requires invoice_sales_rep_code is not null -- the
    -- same signal rep_collected_actuals already used -- so cash that can't
    -- be traced to any real sales invoice at all (on-account cash, other
    -- SAP doc types) no longer inflates the Sales-facing "Payments
    -- Collected" total. That excluded cash is Finance's own reconciliation
    -- concern; not surfaced anywhere on this page.
    --
    -- distinct_customers (2026-09-30, new) -- Payments Collected card's own
    -- "Distinct Customers Paid" sub-metric, from the customer_code now
    -- carried on base_payment_apps.
    select
        coalesce(sum(amount_applied_myr) filter (where
            payment_date::date >= v_effective_start_date
            and payment_date::date <= v_effective_end_date
        ), 0) as total_collected,

        -- Payment count (added 2026-08, O2C funnel restructure) -- same
        -- filter as total_collected above, so the funnel stat-strip's
        -- Payment-stage count and value always tie out.
        count(*) filter (where
            payment_date::date >= v_effective_start_date
            and payment_date::date <= v_effective_end_date
        ) as payment_count,

        count(distinct invoice_customer_code) filter (where
            payment_date::date >= v_effective_start_date
            and payment_date::date <= v_effective_end_date
        ) as distinct_customers
    from base_payment_apps
    where invoice_sales_rep_code is not null
),

-- Prior-period sibling (2026-09-30) -- for totalCollected's own subvalue
-- delta and collectionRatePct's own delta.
prev_collected_kpis as (
    select
        coalesce(sum(amount_applied_myr) filter (where
            payment_date::date >= v_prev_start_date
            and payment_date::date <= v_prev_end_date
        ), 0) as total_collected
    from base_payment_apps
    where invoice_sales_rep_code is not null
),

lead_kpis as (
    select
        coalesce(sum(actual_revenue) filter (
            where stage = 'WON'
            and closed_date >= v_effective_start_date
            and closed_date <= v_effective_end_date + interval '1 day'
        ), 0) as won_revenue,

        -- Won lead count (added 2026-08, O2C funnel restructure) -- IDENTICAL
        -- filter to won_revenue above, so the funnel stat-strip's
        -- Pipeline-stage count and value always tie out. Deliberately NOT
        -- reusing stageData's WON row count -- that CTE's own window is a
        -- broader "created_at OR closed_date" OR (see its comment below),
        -- so pairing it with won_revenue's narrower closed_date-only window
        -- would silently combine two counts computed under different
        -- filters -- exactly the kind of drift DASHBOARD-CONVENTIONS.md
        -- warns against.
        count(*) filter (
            where stage = 'WON'
            and closed_date >= v_effective_start_date
            and closed_date <= v_effective_end_date + interval '1 day'
        ) as won_lead_count,

        coalesce(round(
            (count(*) filter (
                where stage = 'WON'
                and closed_date >= v_effective_start_date
                and closed_date <= v_effective_end_date + interval '1 day'
            )::numeric /
            nullif(count(*) filter (
                where stage in ('WON', 'LOST')
                and closed_date >= v_effective_start_date
                and closed_date <= v_effective_end_date + interval '1 day'
            ), 0)) * 100,
        1), 0) as win_rate_pct,

        coalesce(round(avg(actual_revenue) filter (
            where stage = 'WON'
            and closed_date >= v_effective_start_date
            and closed_date <= v_effective_end_date + interval '1 day'
        )), 0) as avg_deal_size,

        coalesce(round(
            (avg(extract(epoch from (closed_date - created_at)) / 86400) filter (
                where stage = 'WON'
                and closed_date >= v_effective_start_date
                and closed_date <= v_effective_end_date + interval '1 day'
            ))::numeric,
        1), 0) as avg_days_to_close,

        count(*) filter (
            where quotation_url is not null
            and created_at >= v_effective_start_date
            and created_at <= v_effective_end_date + interval '1 day'
        ) as quoted_count,

        count(*) filter (
            where quotation_url is not null and stage = 'WON'
            and closed_date >= v_effective_start_date
            and closed_date <= v_effective_end_date + interval '1 day'
        ) as quoted_and_won_count,

        coalesce(round(
            (percentile_cont(0.5) within group (
                order by extract(epoch from (closed_date - created_at)) / 86400
            ) filter (
                where quotation_url is not null and stage = 'WON'
                and closed_date >= v_effective_start_date
                and closed_date <= v_effective_end_date + interval '1 day'
            ))::numeric,
        1), 0) as median_days_to_win,

        -- Open-pipeline snapshot (added 2026-07, Sales Reports redesign) --
        -- deliberately NOT bounded by v_effective_start_date/
        -- v_effective_end_date: "how much is in play right now" is a
        -- point-in-time figure, not a period flow (the one snapshot row on
        -- the new "Leads vs Target" card -- see DASHBOARD-CONVENTIONS.md's
        -- SNAPSHOT family). Copied verbatim from get_sales_leads_dashboard's
        -- own activePipelineValue/weightedPipelineValue so the Tier-2 and
        -- Tier-3 pages can never report a different open pipeline for the
        -- same owner/product-type filters -- same mirroring rationale as
        -- pipeline_target_math above.
        coalesce(sum(expected_revenue) filter (
            where stage not in ('WON', 'LOST') and not is_cancelled
        ), 0) as active_pipeline_value,

        -- close_probability is nullable, so a lead with no probability set
        -- contributes 0 here (numeric * null -> null, which sum() skips) --
        -- identical behaviour to get_sales_leads_dashboard's version,
        -- intentionally not "fixed" with an inner coalesce, so the two never
        -- diverge.
        coalesce(sum(expected_revenue * (close_probability / 100.0)) filter (
            where stage not in ('WON', 'LOST') and not is_cancelled
        ), 0) as weighted_pipeline_value,

        -- Period-bound opportunity count -- mirrors get_sales_leads_dashboard
        -- 's totalLeadsCreated (leads CREATED in the window, not closed in
        -- it). Kept for compatibility -- not wired into the restructured
        -- "Leads vs Target" card, same "orphaned but harmless" treatment
        -- Attendance gives leaveFractionErrorCount.
        count(*) filter (
            where created_at >= v_effective_start_date
            and created_at <= v_effective_end_date + interval '1 day'
        ) as total_opportunities

    from base_leads
),

-- Prior-period sibling (2026-09-30) -- only won_revenue is needed, for
-- pipelineAttainmentPct's own subvalue delta.
prev_lead_kpis as (
    select coalesce(sum(actual_revenue) filter (
        where stage = 'WON'
        and closed_date >= v_prev_start_date
        and closed_date <= v_prev_end_date + interval '1 day'
    ), 0) as won_revenue
    from base_leads
),

-- Top customers by invoiced revenue -- pulled out into its own CTE
-- (2026-09-30, previously an inline subquery duplicated for the chart only)
-- so BOTH the existing topInvoicedCustomersData chart AND the new Customer
-- Concentration KPI card read from ONE query instead of two. MATERIALIZED:
-- referenced twice below.
--
-- "Customer" (SAP customer_code on sap_invoices), NOT "Client" (the
-- CRM-native `clients` table used by topClientsData) -- see
-- DASHBOARD-CONVENTIONS.md's "Client vs Customer" rule.
top_invoiced_customers as materialized (
    select
        customer_code,
        customer_name,
        count(distinct doc_entry) as invoice_count,
        sum(total_amount_myr) as revenue_myr
    from base_invoices
    where "invoice_date"::date >= v_effective_start_date
      and "invoice_date"::date <= v_effective_end_date
    group by customer_code, customer_name
    order by revenue_myr desc
    limit 10
),

-- Top Products -- pulled out into its own CTE (2026-09-30, same reasoning as
-- top_invoiced_customers above), backing both topProductsData and the new
-- Product Concentration KPI card. MATERIALIZED: referenced twice below.
top_invoiced_products as materialized (
    select
        bil.item_code,
        coalesce(it.item_name, bil.item_code) as item_name,
        ig.group_name as item_group_name,
        sum(bil.quantity) as quantity_sold,
        sum(bil.line_total * bil.doc_myr_ratio) as revenue_myr
    from base_invoice_lines bil
    left join sap_items it on it.item_code = bil.item_code
    left join sap_item_groups ig on ig.group_code = it.item_group_code
    group by bil.item_code, coalesce(it.item_name, bil.item_code), ig.group_name
    order by revenue_myr desc
    limit 10
),

-- Revenue by product group, ALL groups (not top-N) -- pulled out into its
-- own CTE (2026-09-30, same reasoning), backing both revenueByProductGroupData
-- and the new Product Group Concentration KPI card. MATERIALIZED: referenced
-- twice below.
invoiced_by_product_group as materialized (
    select
        coalesce(ig.group_name, 'Ungrouped') as item_group_name,
        sum(bil.quantity) as quantity_sold,
        sum(bil.line_total * bil.doc_myr_ratio) as revenue_myr
    from base_invoice_lines bil
    left join sap_items it on it.item_code = bil.item_code
    left join sap_item_groups ig on ig.group_code = it.item_group_code
    group by coalesce(ig.group_name, 'Ungrouped')
)

select json_build_object(

    -- FIXED 2026-09-30: json_build_object has a hard 100-argument limit
    -- (50 key/value pairs) -- this object grew to 52 pairs once the
    -- restructuring's prev_*/concentration/Sales Order Health fields were
    -- all added, which failed at call time with "cannot pass more than 100
    -- arguments to a function" (error 54023). Split into 4 jsonb_build_object
    -- chunks (well under the limit each) merged with || (jsonb's own object
    -- concatenation operator), then cast once to json at the end -- same
    -- flat kpis.* shape on the frontend, no consumer-side change needed.
    'kpis', (
        select (
        jsonb_build_object(
            -- ─── CARD 1: Leads vs Target ────────────────────────────────
            'pipelineWonRevenue', lk.won_revenue,
            'prevPipelineWonRevenue', plk.won_revenue,
            'pipelineTargetRevenue', coalesce(pt.prorated_target, 0),
            'prevPipelineTargetRevenue', coalesce(ppt.prorated_target, 0),
            'pipelineAttainmentPct', case when coalesce(pt.prorated_target, 0) > 0
                then round((lk.won_revenue / pt.prorated_target) * 100)
                else 0 end,
            -- Prior-period sibling (2026-09-30) -- null (not 0) when the
            -- prior period had no target at all, so calcDelta on the
            -- frontend renders "no comparison" rather than a false swing.
            'prevPipelineAttainmentPct', case when coalesce(ppt.prorated_target, 0) > 0
                then round((plk.won_revenue / ppt.prorated_target) * 100)
                else null end,
            'winRatePct', lk.win_rate_pct,
            -- Live snapshot, ignores the date filter entirely (see
            -- lead_kpis' own comment) -- this card's one SNAPSHOT-family row.
            'activePipelineValue', lk.active_pipeline_value,
            'avgDaysToClose', lk.avg_days_to_close,
            'wonLeadCount', lk.won_lead_count,
            -- Computed, not wired into the restructured tile -- see
            -- lead_kpis' own comment.
            'weightedPipelineValue', lk.weighted_pipeline_value,
            'avgDealSize', lk.avg_deal_size,
            'quoteToWinConversionPct', case when lk.quoted_count > 0
                then round((lk.quoted_and_won_count::numeric / lk.quoted_count) * 100, 1)
                else 0 end,
            'medianDaysToWin', lk.median_days_to_win,
            'totalOpportunities', lk.total_opportunities
        ) || jsonb_build_object(
            -- ─── CARD 2: Sales Orders ───────────────────────────────────
            'orderBookValue', ob.order_value,
            'prevOrderBookValue', pob.order_value,
            'orderBookCount', ob.order_count,
            'avgOrderValue', case when ob.order_count > 0
                then round(ob.order_value / ob.order_count, 2)
                else 0 end,
            'distinctCustomersOrdering', ob.distinct_customers,

            -- ─── CARD 3: Invoiced Revenue ───────────────────────────────
            'totalInvoiced', ik.total_invoiced,
            'prevTotalInvoiced', pik.total_invoiced,
            'invoiceCount', ik.invoice_count,
            'avgInvoiceValue', case when ik.invoice_count > 0
                then round(ik.total_invoiced / ik.invoice_count, 2)
                else 0 end,
            'revenueBudgetTotal', coalesce(bt.total_budget, 0),
            'budgetAttainmentPct', case when coalesce(bt.total_budget, 0) > 0
                then round((ik.total_invoiced / bt.total_budget) * 100)
                else 0 end,
            'prevBudgetAttainmentPct', case when coalesce(pbt.total_budget, 0) > 0
                then round((pik.total_invoiced / pbt.total_budget) * 100)
                else null end
        ) || jsonb_build_object(
            -- ─── CARD 4: Payments Collected ─────────────────────────────
            -- totalCollected now excludes cash not resolved against a real
            -- sales invoice -- see collected_kpis' own comment (2026-09-30
            -- fix, finding #1 in this function's header comment).
            'totalCollected', ck.total_collected,
            'prevTotalCollected', pck.total_collected,
            'paymentCount', ck.payment_count,
            'distinctCustomersPaid', ck.distinct_customers,
            'collectionRatePct', case when ik.total_invoiced > 0
                then round((ck.total_collected / ik.total_invoiced) * 100, 1)
                else 0 end,
            'prevCollectionRatePct', case when pik.total_invoiced > 0
                then round((pck.total_collected / pik.total_invoiced) * 100, 1)
                else null end,

            -- ─── CARDS 5-7: Concentration ───────────────────────────────
            -- Customer Concentration -- numerator (top 5 of
            -- top_invoiced_customers) and denominator (ik.total_invoiced)
            -- are both from base_invoices, same window -- exact, not
            -- approximate. null (not 0) when there's no invoiced revenue to
            -- divide by, same "no guessed green" reasoning the original tile
            -- already used.
            'customerConcentrationPct', case when ik.total_invoiced > 0
                then round((cc.top_n_revenue / ik.total_invoiced) * 100)
                else null end,
            'top5CustomerRevenue', coalesce(cc.top_n_revenue, 0),
            'topCustomerName', cc.top_name,
            'topCustomerPct', case when ik.total_invoiced > 0 and cc.top_revenue is not null
                then round((cc.top_revenue / ik.total_invoiced) * 100)
                else null end,

            -- Product Concentration (new) -- numerator (top 5 of
            -- top_invoiced_products) and denominator (total_invoice_line_
            -- revenue) both from base_invoice_lines, same window -- same
            -- "exact, not approximate" principle.
            'productConcentrationPct', case when tlr.total > 0
                then round((pc.top_n_revenue / tlr.total) * 100)
                else null end,
            'top5ProductRevenue', coalesce(pc.top_n_revenue, 0),
            'topProductName', pc.top_name,
            'topProductPct', case when tlr.total > 0 and pc.top_revenue is not null
                then round((pc.top_revenue / tlr.total) * 100)
                else null end,

            -- Product Group Concentration (new) -- top 3 (not top 5) since
            -- only ~13 groups exist total, so top-3 is the more meaningful
            -- cut. Same denominator as Product Concentration above (both
            -- read the full base_invoice_lines universe).
            'productGroupConcentrationPct', case when tlr.total > 0
                then round((gc.top_n_revenue / tlr.total) * 100)
                else null end,
            'top3GroupRevenue', coalesce(gc.top_n_revenue, 0),
            'topGroupName', gc.top_name,
            'topGroupPct', case when tlr.total > 0 and gc.top_revenue is not null
                then round((gc.top_revenue / tlr.total) * 100)
                else null end
        ) || jsonb_build_object(
            -- ─── CARD 8: Sales Order Health (new, ACTIONABLE) ───────────
            -- Pre-computed above via the backlog-vs-period if/else -- see
            -- v_overdue_deliveries_count's own declaration comment.
            'overdueDeliveriesCount', v_overdue_deliveries_count,
            'deliveryDueSoonCount', v_delivery_due_soon_count,
            'paymentMismatchesCount', v_payment_mismatches_count,
            'notYetInvoicedCount', v_not_yet_invoiced_count,
            'salesOrderNeedsAttentionCount', v_needs_attention_count,

            -- Resolved SAP identity (added 2026-08) -- the v_sales_rep_code
            -- this whole request was scoped by (see the guard/resolution
            -- block above), exposed so the frontend can drive drill-through
            -- links (e.g. into sales/orders) without a second lookup. -1 is
            -- the "selected owner has no employee_sales_rep_mapping row"
            -- sentinel -- never a real SAP SlpCode -- surfaced plainly here
            -- as -1, not nulled out, so a caller inspecting this field
            -- directly can tell the two "no rep" cases apart (no owner
            -- selected at all vs owner selected but unmapped) if it ever
            -- needs to; ownerSapMappingMissing below is the friendlier flag
            -- for the common case of just wanting to show an explanatory UI
            -- note.
            'resolvedSalesRepCode', v_sales_rep_code,

            -- FIXED 2026-08, see the guard/resolution block above -- true
            -- only when a Salesperson filter is active AND that employee has
            -- no employee_sales_rep_mapping.employee_id row, so the frontend
            -- can show "this salesperson has no linked SAP rep" instead of a
            -- page that just looks empty with no explanation.
            'ownerSapMappingMissing', (v_owner_id is not null and v_sales_rep_code = -1)
        )
        )::json
        from lead_kpis lk
        cross join prev_lead_kpis plk
        cross join pipeline_target_math pt
        cross join prev_pipeline_target_math ppt
        cross join order_book_kpi ob
        cross join prev_order_book_kpi pob
        cross join invoice_kpis ik
        cross join prev_invoice_kpis pik
        cross join collected_kpis ck
        cross join prev_collected_kpis pck
        cross join total_invoice_line_revenue tlr
        left join (select coalesce(sum(prorated_budget), 0) as total_budget from budget_math) bt on true
        left join (select coalesce(sum(prorated_budget), 0) as total_budget from prev_budget_math) pbt on true
        left join (
            select
                coalesce(sum(revenue_myr) filter (where rn <= 5), 0) as top_n_revenue,
                max(customer_name) filter (where rn = 1) as top_name,
                max(revenue_myr) filter (where rn = 1) as top_revenue
            from (select customer_name, revenue_myr, row_number() over (order by revenue_myr desc) as rn from top_invoiced_customers) t
        ) cc on true
        left join (
            select
                coalesce(sum(revenue_myr) filter (where rn <= 5), 0) as top_n_revenue,
                max(item_name) filter (where rn = 1) as top_name,
                max(revenue_myr) filter (where rn = 1) as top_revenue
            from (select item_name, revenue_myr, row_number() over (order by revenue_myr desc) as rn from top_invoiced_products) t
        ) pc on true
        left join (
            select
                coalesce(sum(revenue_myr) filter (where rn <= 3), 0) as top_n_revenue,
                max(item_group_name) filter (where rn = 1) as top_name,
                max(revenue_myr) filter (where rn = 1) as top_revenue
            from (select item_group_name, revenue_myr, row_number() over (order by revenue_myr desc) as rn from invoiced_by_product_group) t
        ) gc on true
    ),

    -- The company's real sales analysis, per rep: PO (sales order) vs Invoice
    -- vs Budget variance -- see rep_order_actuals/rep_invoice_actuals/
    -- budget_math above. All three legs and attainment_percentage are
    -- computed purely from sales_rep_code (SAP identity) -- employees/
    -- profiles below are for display (name/avatar) only, never for the
    -- attribution math itself. Bridged via employee_sales_rep_mapping
    -- (auto-created per SAP rep; employee_id is the one manually-assigned
    -- column), not sap_sales_persons.employee_id (EmpID) -- see
    -- docs/DASHBOARD-ROADMAP.md §1.1.
    --
    -- Content unchanged (2026-09-30) -- confirmed good, no restructuring --
    -- only its underlying CTEs' default time window shifted to This Month.
    'invoiceBudgetScorecardData', (
        select coalesce(json_agg(
            json_build_object(
                'sales_rep_code', coalesce(o.sales_rep_code, a.sales_rep_code, c.sales_rep_code, b.sales_rep_code),
                'employee_uuid', e.id,
                'rep_name', coalesce(sp.sales_rep_name, 'Unknown'),
                'avatar_url', p.avatar_url,
                'order_value_myr', coalesce(o.order_value, 0),
                'invoiced_revenue', coalesce(a.invoiced_revenue, 0),
                -- Cash collected against this rep's invoices in the period
                -- (added 2026-07) -- 4th leg, completing Order -> Invoice ->
                -- Collected -> Budget. 0 here can be a real attribution gap
                -- (on-account cash), not necessarily no collections --
                -- cross-check against kpis.totalCollected. See
                -- rep_collected_actuals above.
                'collected_myr', coalesce(c.collected_myr, 0),
                'budget_revenue', coalesce(b.prorated_budget, 0),
                'attainment_percentage', case
                    when coalesce(b.prorated_budget, 0) > 0
                    then round((coalesce(a.invoiced_revenue, 0) / b.prorated_budget) * 100)
                    else 0
                end,
                -- Booked (PO) vs Budget -- is what's been ordered on pace with target.
                'po_vs_budget_variance_myr', coalesce(o.order_value, 0) - coalesce(b.prorated_budget, 0),
                -- Booked (PO) vs Invoiced -- backlog not yet invoiced (positive)
                -- or over-invoiced relative to booked orders (negative, e.g.
                -- invoices against orders booked in an earlier period).
                'po_vs_invoice_variance_myr', coalesce(o.order_value, 0) - coalesce(a.invoiced_revenue, 0),
                -- Invoiced vs Collected (added 2026-07) -- cash still
                -- outstanding against this period's invoices (positive), or
                -- collections exceeding what was invoiced in it (negative --
                -- cash landing against invoices raised earlier). Same sign
                -- convention as po_vs_invoice_variance_myr above.
                'invoice_vs_collected_variance_myr', coalesce(a.invoiced_revenue, 0) - coalesce(c.collected_myr, 0),
                'collection_rate_pct', case
                    when coalesce(a.invoiced_revenue, 0) > 0
                    then round((coalesce(c.collected_myr, 0) / a.invoiced_revenue) * 100, 1)
                    else 0
                end
            ) order by coalesce(a.invoiced_revenue, 0) desc
        ), '[]'::json)
        from rep_order_actuals o
        full outer join rep_invoice_actuals a on a.sales_rep_code = o.sales_rep_code
        full outer join rep_collected_actuals c on c.sales_rep_code = coalesce(o.sales_rep_code, a.sales_rep_code)
        full outer join budget_math b on b.sales_rep_code = coalesce(o.sales_rep_code, a.sales_rep_code, c.sales_rep_code)
        left join sap_sales_persons sp on sp.sales_rep_code = coalesce(o.sales_rep_code, a.sales_rep_code, c.sales_rep_code, b.sales_rep_code)
        left join employee_sales_rep_mapping m on m.sales_rep_code = coalesce(o.sales_rep_code, a.sales_rep_code, c.sales_rep_code, b.sales_rep_code)
        left join employees e on e.id = m.employee_id
        left join profiles p on p.id = e.profile_id
        where coalesce(o.order_value, 0) > 0
           or coalesce(a.invoiced_revenue, 0) > 0
           or coalesce(c.collected_myr, 0) > 0
           or coalesce(b.prorated_budget, 0) > 0
    ),

    -- Same figures as invoiceBudgetScorecardData's order_value_myr, just
    -- re-shaped for the bar chart -- sourced from rep_order_actuals (keyed by
    -- sales_rep_code) rather than re-aggregating, so the two can never drift.
    -- Chart, deferred -- unchanged except inheriting rep_order_actuals' own
    -- new This-Month default (see that CTE's comment).
    'orderBookData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                coalesce(sp.sales_rep_name, 'Unknown') as name,
                o.order_value as order_value_myr
            from rep_order_actuals o
            left join sap_sales_persons sp on sp.sales_rep_code = o.sales_rep_code
            order by order_value_myr desc
            limit 15
        ) x
    ),

    -- The two systems of record, side by side, never blended (see the file
    -- header comment and docs/DASHBOARD-IA-STRATEGY.md §7). Chart, deferred
    -- -- deliberately LEFT ON raw p_start_date/p_end_date (all-time when
    -- unset): a monthly trend forced to This Month would collapse to one
    -- point. Unchanged this pass.
    'realizedVsPipelineData', (
        with pipeline_by_month as (
            select
                to_char(date_trunc('month', closed_date), 'YYYY-MM') as month,
                sum(actual_revenue) as pipeline_revenue
            from base_leads
            where stage = 'WON'
              and (p_start_date is null or closed_date >= p_start_date)
              and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            group by 1
        ),
        realized_by_month as (
            select
                to_char(date_trunc('month', "invoice_date"::date), 'YYYY-MM') as month,
                sum(total_amount_myr) as realized_revenue
            from base_invoices
            where (p_start_date is null or "invoice_date"::date >= p_start_date)
              and (p_end_date is null or "invoice_date"::date <= p_end_date)
            group by 1
        )
        select coalesce(json_agg(json_build_object(
            'period', coalesce(pm.month, rm.month),
            'pipeline_revenue_myr', coalesce(pm.pipeline_revenue, 0),
            'realized_revenue_myr', coalesce(rm.realized_revenue, 0)
        ) order by coalesce(pm.month, rm.month)), '[]'::json)
        from pipeline_by_month pm
        full outer join realized_by_month rm on rm.month = pm.month
    ),

    -- Bookings vs Invoiced (added 2026-07, Sales Reports redesign) -- SAP-only
    -- booking-to-billing lag. FIXED-WINDOW family already -- always the
    -- trailing 12 months, ignores the page's date filter entirely. Unchanged
    -- this pass (chart, deferred, and this one was already correct).
    'bookingsVsInvoicedTrendData', (
        with booked_by_month as (
            select
                to_char(date_trunc('month', "order_date"::date), 'YYYY-MM') as month,
                sum(total_amount_myr) as booked_revenue
            from base_orders
            where "order_date"::date >= (date_trunc('month', current_date) - interval '11 months')::date
              and "order_date"::date <  (date_trunc('month', current_date) + interval '1 month')::date
            group by 1
        ),
        invoiced_by_month as (
            select
                to_char(date_trunc('month', "invoice_date"::date), 'YYYY-MM') as month,
                sum(total_amount_myr) as invoiced_revenue
            from base_invoices
            where "invoice_date"::date >= (date_trunc('month', current_date) - interval '11 months')::date
              and "invoice_date"::date <  (date_trunc('month', current_date) + interval '1 month')::date
            group by 1
        )
        select coalesce(json_agg(json_build_object(
            'period', coalesce(bm.month, im.month),
            'booked_revenue_myr', coalesce(bm.booked_revenue, 0),
            'invoiced_revenue_myr', coalesce(im.invoiced_revenue, 0)
        ) order by coalesce(bm.month, im.month)), '[]'::json)
        from booked_by_month bm
        full outer join invoiced_by_month im on im.month = bm.month
    ),

    -- Invoiced / Collected / Budget -- monthly trend. Chart, deferred --
    -- deliberately LEFT ON raw p_start_date/p_end_date (all-time when
    -- unset), same "a monthly trend needs width" reasoning as
    -- realizedVsPipelineData above. Unchanged this pass.
    'invoicedVsBudgetTrendData', (
        with invoiced_by_month as (
            select
                to_char(date_trunc('month', "invoice_date"::date), 'YYYY-MM') as month,
                sum(total_amount_myr) as invoiced_revenue
            from base_invoices
            where (p_start_date is null or "invoice_date"::date >= p_start_date)
              and (p_end_date   is null or "invoice_date"::date <= p_end_date)
            group by 1
        ),
        collected_by_month as (
            select
                to_char(date_trunc('month', payment_date::date), 'YYYY-MM') as month,
                sum(amount_applied_myr) as collected_revenue
            from base_payment_apps
            where (p_start_date is null or payment_date::date >= p_start_date)
              and (p_end_date   is null or payment_date::date <= p_end_date)
            group by 1
        ),
        budget_by_month as (
            select
                to_char(date_trunc('month', b.budget_month), 'YYYY-MM') as month,
                sum(b.budget_revenue) as budget_revenue
            from sales_budgets b
            where (p_start_date is null or date_trunc('month', b.budget_month) >= date_trunc('month', p_start_date))
              and (p_end_date   is null or date_trunc('month', b.budget_month) <= date_trunc('month', p_end_date))
            group by 1
        )
        select coalesce(json_agg(json_build_object(
            'period', coalesce(im.month, cm.month, bm.month),
            'invoiced_revenue_myr', coalesce(im.invoiced_revenue, 0),
            'collected_revenue_myr', coalesce(cm.collected_revenue, 0),
            'budget_revenue_myr', coalesce(bm.budget_revenue, 0)
        ) order by coalesce(im.month, cm.month, bm.month)), '[]'::json)
        from invoiced_by_month im
        full outer join collected_by_month cm on cm.month = im.month
        full outer join budget_by_month bm on bm.month = coalesce(im.month, cm.month)
    ),

    -- Chart, deferred -- unchanged, still all-time by default.
    'grossProfitByRepData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                coalesce(sp.sales_rep_name, 'Unknown') as name,
                coalesce(sum(oi.total_amount_myr), 0) as revenue_myr,
                -- Same GrosProfit outlier guard as get_finance_dashboard --
                -- SAP's own GP field carries a known item-cost master-data
                -- defect at the extremes.
                coalesce(sum(
                    case
                        when oi.total_amount_myr <> 0 and abs(oi.gross_profit) > abs(oi.total_amount_myr) * 5
                        then null
                        else oi.gross_profit
                    end
                ), 0) as gross_profit_myr
            from base_invoices oi
            left join sap_sales_persons sp on sp.sales_rep_code = oi.sales_rep_code
            where (p_start_date is null or oi."invoice_date"::date >= p_start_date)
              and (p_end_date is null or oi."invoice_date"::date <= p_end_date)
            group by sp.sales_rep_name
            order by revenue_myr desc
            limit 15
        ) x
    ),

    -- Pipeline stage funnel. Chart, deferred -- unchanged, still all-time by
    -- default, same dual created_at/closed_date OR window as before.
    'stageData', (
        select coalesce(json_agg(json_build_object(
            'name', name,
            'count', lead_count,
            'total_value', total_value
        ) order by stage_order), '[]'::json)
        from (
            select
                stage::text as name,
                case stage
                    when 'DISCOVERY'   then 1
                    when 'SAMPLE_TEST' then 2
                    when 'PROPOSAL'    then 3
                    when 'NEGOTIATION' then 4
                    when 'WON'         then 5
                    when 'LOST'        then 6
                    else 7
                end as stage_order,
                count(*) as lead_count,
                coalesce(sum(case when stage = 'WON' then actual_revenue else expected_revenue end), 0) as total_value
            from base_leads
            where not is_cancelled
              and (
                  (p_start_date is null and p_end_date is null)
                  or (    (p_start_date is null or created_at  >= p_start_date)
                      and (p_end_date   is null or created_at  <= p_end_date + interval '1 day'))
                  or (    (p_start_date is null or closed_date >= p_start_date)
                      and (p_end_date   is null or closed_date <= p_end_date + interval '1 day'))
              )
            group by stage
        ) x
    ),

    -- Chart, deferred -- unchanged, still all-time by default.
    'productTypeData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                coalesce(product_type::text, 'Unspecified') as name,
                coalesce(sum(actual_revenue) filter (
                    where stage = 'WON'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ), 0) as won_revenue
            from base_leads
            where not is_cancelled
            group by coalesce(product_type::text, 'Unspecified')
            order by won_revenue desc
        ) x
    ),

    -- Chart, deferred -- unchanged, still all-time by default.
    'sourceData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                lst.name,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_revenue
            from base_leads fl
            join lead_source_types lst on lst.id = fl.lead_source_type_id
            where not fl.is_cancelled
            group by lst.name
            order by won_revenue desc
        ) x
    ),

    -- Chart, deferred -- unchanged, still all-time by default.
    'topClientsData', (
        -- Blends both account kinds via base_leads.account_name/account_key
        -- (see the CTE above) -- previously an inner `join clients` silently
        -- dropped every SAP-referenced lead (client_id is null) from this
        -- chart entirely once that became possible (2026-08).
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                fl.account_name as name,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_revenue
            from base_leads fl
            where not fl.is_cancelled
            group by fl.account_key, fl.account_name
            order by won_revenue desc
            limit 10
        ) x
    ),

    -- Top customers by invoiced revenue -- now sourced from top_invoiced_
    -- customers above (2026-09-30, previously its own inline subquery),
    -- which also backs the new Customer Concentration KPI card. Chart
    -- itself unchanged; inherits that CTE's new This-Month default.
    'topInvoicedCustomersData', (
        select coalesce(json_agg(x), '[]'::json)
        from top_invoiced_customers x
    ),

    -- Top Products -- now sourced from top_invoiced_products above
    -- (2026-09-30), which also backs the new Product Concentration KPI card.
    -- Chart itself unchanged; inherits that CTE's new This-Month default.
    'topProductsData', (
        select coalesce(json_agg(x), '[]'::json)
        from top_invoiced_products x
    ),

    -- Revenue by product group -- now sourced from invoiced_by_product_group
    -- above (2026-09-30), which also backs the new Product Group
    -- Concentration KPI card. Chart itself unchanged; inherits that CTE's
    -- new This-Month default.
    'revenueByProductGroupData', (
        select coalesce(json_agg(x order by x.revenue_myr desc), '[]'::json)
        from invoiced_by_product_group x
    )

)
into result;

return result;

end;
$$;
