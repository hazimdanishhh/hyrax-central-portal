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
-- grossProfitByRepData, topInvoicedCustomersData,
-- bookingsVsInvoicedTrendData, invoicedVsBudgetTrendData, and the new
-- base_invoice_lines/topProductsData below) reads FROM this CTE rather than
-- re-querying sap_invoices directly, so they all inherit the filter for
-- free instead of needing their own predicate.
base_invoices as (
    select oi.*
    from sap_invoices oi
    where oi.is_cancelled = 'N'
      and (v_sales_rep_code is null or oi.sales_rep_code = v_sales_rep_code)
),

-- Same v_sales_rep_code scoping as base_invoices above -- rep_order_actuals,
-- orderBookData, and bookingsVsInvoicedTrendData all read FROM this CTE.
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
        i.sales_rep_code as invoice_sales_rep_code
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
      -- in either way -- that's what makes the dept-wide totalCollected wider
      -- than the per-rep sum. See rep_collected_actuals below. NOTE: this
      -- guard must join raw sap_invoices, not base_invoices -- a left join
      -- to base_invoices would make a CANCELLED invoice's i.doc_entry come
      -- back null too, and the "i.doc_entry is null or ..." form below would
      -- then incorrectly KEEP it instead of excluding it.
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
pipeline_target_math as (
    select
        sum(
            t.target_revenue * (
                case
                    when p_start_date is null and p_end_date is null then 1
                    else
                        greatest(0,
                            (least(coalesce(p_end_date, '2099-12-31'::date), (t.target_month + interval '1 month' - interval '1 day')::date) -
                            greatest(coalesce(p_start_date, '1900-01-01'::date), t.target_month)) + 1
                        ) / extract(day from (t.target_month + interval '1 month' - interval '1 day'))
                end
            )
        ) as prorated_target
    from sales_targets t
    where (v_owner_id is null or t.lead_owner_id = v_owner_id)
),

-- Forecast 2: per-rep prorated invoice budget (identical proration formula,
-- keyed by sales_rep_code instead of lead_owner_id). v_sales_rep_code
-- scoping added 2026-08 -- previously had no owner/rep filter at all, the
-- clearest instance of the Invoice Budget Scorecard always showing every
-- rep regardless of the page's Owner filter.
budget_math as (
    select
        b.sales_rep_code,
        sum(
            b.budget_revenue * (
                case
                    when p_start_date is null and p_end_date is null then 1
                    else
                        greatest(0,
                            (least(coalesce(p_end_date, '2099-12-31'::date), (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day')::date) -
                            greatest(coalesce(p_start_date, '1900-01-01'::date), date_trunc('month', b.budget_month)::date)) + 1
                        ) / extract(day from (date_trunc('month', b.budget_month) + interval '1 month' - interval '1 day'))
                end
            )
        ) as prorated_budget
    from sales_budgets b
    where (v_sales_rep_code is null or b.sales_rep_code = v_sales_rep_code)
    group by b.sales_rep_code
),

rep_invoice_actuals as (
    select
        sales_rep_code,
        coalesce(sum(total_amount_myr), 0) as invoiced_revenue
    from base_invoices
    where (p_start_date is null or "invoice_date"::date >= p_start_date)
      and (p_end_date is null or "invoice_date"::date <= p_end_date)
    group by sales_rep_code
),

-- Top Products (added 2026-08) -- line-level SAP data behind topProductsData
-- below, the first real "actual sales" product cut on this page (previously
-- the only product cut was sales_leads.product_type, a 3-value CRM enum
-- with no link to a real SKU). Sourced from INV1 (billed/invoiced), not
-- RDR1 (booked) -- mirrors this page's existing convention that "Invoice"
-- is always the audited/system-of-record figure (see
-- docs/DASHBOARD-CONVENTIONS.md's Source-labeling table); a "booked"
-- companion from sap_sales_order_lines is a cheap future addition, not
-- built here. Joins base_invoices (not sap_invoices directly), so this
-- inherits BOTH the is_cancelled filter and the v_sales_rep_code scoping
-- above for free.
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
    where (p_start_date is null or bi."invoice_date"::date >= p_start_date)
      and (p_end_date is null or bi."invoice_date"::date <= p_end_date)
),

-- The company's actual sales-side analysis: PO (sales order) vs Invoice vs
-- Budget variance, per rep -- see invoiceBudgetScorecardData below, which
-- joins this against rep_invoice_actuals/budget_math. Keyed by sales_rep_code
-- (not sales_rep_name, unlike the old orderBookData grouping) so two reps
-- sharing a display name can never collapse into one row.
rep_order_actuals as (
    select
        sales_rep_code,
        coalesce(sum(total_amount_myr), 0) as order_value
    from base_orders
    where (p_start_date is null or "order_date"::date >= p_start_date)
      and (p_end_date is null or "order_date"::date <= p_end_date)
    group by sales_rep_code
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
-- LESS than kpis.totalCollected, which counts every applied row including
-- the unattributable ones. Don't "fix" it by dropping the is-not-null
-- filter -- unattributed cash genuinely can't be credited to a rep.
rep_collected_actuals as (
    select
        invoice_sales_rep_code as sales_rep_code,
        coalesce(sum(amount_applied_myr), 0) as collected_myr
    from base_payment_apps
    where invoice_sales_rep_code is not null
      and (p_start_date is null or payment_date::date >= p_start_date)
      and (p_end_date   is null or payment_date::date <= p_end_date)
    group by invoice_sales_rep_code
),

-- Dept-wide SAP period totals (added 2026-07) -- the invoice/cash analogue
-- of pipeline_target_math above: single-row aggregates cross-joined into
-- kpis below. This RPC previously had NO dept-wide invoiced figure in kpis
-- at all -- the Invoice Budget Attainment tile summed
-- invoiceBudgetScorecardData's per-rep invoiced_revenue client-side
-- (config/overviewConfig.js). Same base CTE and same window as
-- rep_invoice_actuals above, so the two always tie out -- except one edge
-- case the client-side sum gets wrong: the scorecard's own WHERE drops any
-- rep row whose three (now four) legs are all <= 0, so a net-negative
-- invoiced rep with no orders/collections/budget would be silently omitted
-- from the client sum but is correctly counted here.
invoice_kpis as (
    select
        coalesce(sum(total_amount_myr) filter (where
            (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date is null or "invoice_date"::date <= p_end_date)
        ), 0) as total_invoiced,

        -- doc_entry is sap_invoices' primary key, so this is exactly
        -- count(*); spelled distinct to match get_finance_dashboard's own
        -- invoice_count idiom.
        count(distinct doc_entry) filter (where
            (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date is null or "invoice_date"::date <= p_end_date)
        ) as invoice_count
    from base_invoices
),

collected_kpis as (
    -- Dept-wide, deliberately WITHOUT rep_collected_actuals' "is not null"
    -- filter: on-account cash and other document types are real collections
    -- even when they can't be attributed to a rep. See rep_collected_actuals
    -- above.
    select
        coalesce(sum(amount_applied_myr) filter (where
            (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date is null or payment_date::date <= p_end_date)
        ), 0) as total_collected,

        -- Payment count (added 2026-08, O2C funnel restructure) -- same
        -- filter as total_collected above, so the funnel stat-strip's
        -- Payment-stage count and value always tie out.
        count(*) filter (where
            (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date is null or payment_date::date <= p_end_date)
        ) as payment_count
    from base_payment_apps
),

lead_kpis as (
    select
        coalesce(sum(actual_revenue) filter (
            where stage = 'WON'
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
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
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
        ) as won_lead_count,

        coalesce(round(
            (count(*) filter (
                where stage = 'WON'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            )::numeric /
            nullif(count(*) filter (
                where stage in ('WON', 'LOST')
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ), 0)) * 100,
        1), 0) as win_rate_pct,

        coalesce(round(avg(actual_revenue) filter (
            where stage = 'WON'
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
        )), 0) as avg_deal_size,

        coalesce(round(
            (avg(extract(epoch from (closed_date - created_at)) / 86400) filter (
                where stage = 'WON'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ))::numeric,
        1), 0) as avg_days_to_close,

        count(*) filter (
            where quotation_url is not null
            and (p_start_date is null or created_at >= p_start_date)
            and (p_end_date is null or created_at <= p_end_date + interval '1 day')
        ) as quoted_count,

        count(*) filter (
            where quotation_url is not null and stage = 'WON'
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
        ) as quoted_and_won_count,

        coalesce(round(
            (percentile_cont(0.5) within group (
                order by extract(epoch from (closed_date - created_at)) / 86400
            ) filter (
                where quotation_url is not null and stage = 'WON'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ))::numeric,
        1), 0) as median_days_to_win,

        -- Open-pipeline snapshot (added 2026-07, Sales Reports redesign) --
        -- deliberately NOT bounded by p_start_date/p_end_date: "how much is
        -- in play right now" is a point-in-time figure, not a period flow.
        -- Copied verbatim from get_sales_leads_dashboard's own
        -- activePipelineValue/weightedPipelineValue so the Tier-2 and Tier-3
        -- pages can never report a different open pipeline for the same
        -- owner/product-type filters -- same mirroring rationale as
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
        -- it). Feeds the client-side Pipeline Velocity tile in
        -- config/overviewConfig.js.
        count(*) filter (
            where (p_start_date is null or created_at >= p_start_date)
            and (p_end_date is null or created_at <= p_end_date + interval '1 day')
        ) as total_opportunities

    from base_leads
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'pipelineTargetRevenue', coalesce(pt.prorated_target, 0),
            'pipelineWonRevenue', lk.won_revenue,
            -- O2C funnel stat-strip count (added 2026-08) -- see lead_kpis
            -- above for why this isn't shared with stageData's WON count.
            'wonLeadCount', lk.won_lead_count,
            'pipelineAttainmentPct', case when coalesce(pt.prorated_target, 0) > 0
                then round((lk.won_revenue / pt.prorated_target) * 100)
                else 0 end,

            'orderBookValue', (select coalesce(sum(total_amount_myr), 0) from base_orders
                where (p_start_date is null or "order_date"::date >= p_start_date)
                  and (p_end_date is null or "order_date"::date <= p_end_date)
            ),

            -- Order count (added 2026-07) -- same CTE and same window as
            -- orderBookValue above, so "RM X across N orders" always ties out.
            'orderBookCount', (select count(*) from base_orders
                where (p_start_date is null or "order_date"::date >= p_start_date)
                  and (p_end_date is null or "order_date"::date <= p_end_date)
            ),

            'winRatePct', lk.win_rate_pct,
            'avgDealSize', lk.avg_deal_size,
            'avgDaysToClose', lk.avg_days_to_close,

            'quoteToWinConversionPct', case when lk.quoted_count > 0
                then round((lk.quoted_and_won_count::numeric / lk.quoted_count) * 100, 1)
                else 0 end,
            'medianDaysToWin', lk.median_days_to_win,

            -- Open pipeline (added 2026-07) -- point-in-time, NOT period-bound
            -- (see lead_kpis above). The Pipeline Coverage ratio itself
            -- (activePipelineValue / pipelineTargetRevenue) is derived
            -- client-side in config/overviewConfig.js, same as
            -- pipelineAttainmentPct's sibling calc there -- SQL returns the
            -- two legs, never the ratio.
            'activePipelineValue', lk.active_pipeline_value,
            'weightedPipelineValue', lk.weighted_pipeline_value,

            -- Period-bound. Feeds the client-side Pipeline Velocity tile
            -- (opportunities x avg deal size x win rate / cycle days),
            -- likewise derived in config/overviewConfig.js.
            'totalOpportunities', lk.total_opportunities,

            -- ─── Invoiced & collected, dept-wide (added 2026-07) ───────────
            -- All period-bound. None of these respect p_owner_id/
            -- p_product_type -- those only filter base_leads (CRM), exactly
            -- like every existing SAP-sourced field on this page
            -- (orderBookValue/orderBookCount). Same asymmetry the Pipeline
            -- Coverage tile's tooltip already documents.
            'totalInvoiced', ik.total_invoiced,
            'invoiceCount', ik.invoice_count,

            -- Avg invoice value -- deal-size analogue on the SAP side, the
            -- audited counterpart to avgDealSize (CRM, self-reported).
            'avgInvoiceValue', case when ik.invoice_count > 0
                then round(ik.total_invoiced / ik.invoice_count, 2)
                else 0 end,

            -- Cash actually applied against invoices in this window (RCT2 ->
            -- ORCT -> OINV, see base_payment_apps above). Identical formula
            -- and window to get_finance_dashboard's own totalCollected.
            'totalCollected', ck.total_collected,

            -- O2C funnel stat-strip count (added 2026-08) -- same filter as
            -- totalCollected, see collected_kpis above.
            'paymentCount', ck.payment_count,

            -- Cash conversion. NOT "what share of THIS period's invoices got
            -- paid" -- numerator and denominator are two independent
            -- period-bound flows (cash applied in the window vs invoices
            -- raised in the window), so heavy collection against older
            -- invoices can legitimately push this above 100%. Identical
            -- formula/rounding to get_finance_dashboard's collectionRatePct.
            'collectionRatePct', case when ik.total_invoiced > 0
                then round((ck.total_collected / ik.total_invoiced) * 100, 1)
                else 0 end
        )
        from lead_kpis lk
        cross join pipeline_target_math pt
        cross join invoice_kpis ik
        cross join collected_kpis ck
    ),

    -- Resolved SAP identity (added 2026-08) -- the v_sales_rep_code this
    -- whole request was scoped by (see the guard/resolution block above),
    -- exposed so the frontend can drive drill-through links (e.g. into
    -- sales/orders) without a second lookup. -1 is the "selected owner has
    -- no employee_sales_rep_mapping row" sentinel -- never a real SAP
    -- SlpCode -- surfaced plainly here as -1, not nulled out, so a caller
    -- inspecting this field directly can tell the two "no rep" cases apart
    -- (no owner selected at all vs owner selected but unmapped) if it ever
    -- needs to; ownerSapMappingMissing below is the friendlier flag for
    -- the common case of just wanting to show an explanatory UI note.
    'resolvedSalesRepCode', v_sales_rep_code,

    -- FIXED 2026-08, see the guard/resolution block above -- true only when
    -- a Salesperson filter is active AND that employee has no
    -- employee_sales_rep_mapping.employee_id row, so the frontend can show
    -- "this salesperson has no linked SAP rep" instead of a page that just
    -- looks empty with no explanation.
    'ownerSapMappingMissing', (v_owner_id is not null and v_sales_rep_code = -1),

    -- The company's real sales analysis, per rep: PO (sales order) vs Invoice
    -- vs Budget variance -- see rep_order_actuals/rep_invoice_actuals/
    -- budget_math above. All three legs and attainment_percentage are
    -- computed purely from sales_rep_code (SAP identity) -- employees/
    -- profiles below are for display (name/avatar) only, never for the
    -- attribution math itself. Bridged via employee_sales_rep_mapping
    -- (auto-created per SAP rep; employee_id is the one manually-assigned
    -- column), not sap_sales_persons.employee_id (EmpID) -- see
    -- docs/DASHBOARD-ROADMAP.md §1.1.
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
    'orderBookData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                sp.sales_rep_name as name,
                o.order_value as order_value_myr
            from rep_order_actuals o
            join sap_sales_persons sp on sp.sales_rep_code = o.sales_rep_code
            order by order_value_myr desc
            limit 15
        ) x
    ),

    -- The two systems of record, side by side, never blended (see the file
    -- header comment and docs/DASHBOARD-IA-STRATEGY.md §7).
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
    -- booking-to-billing lag: what was ORDERED (sap_sales_orders.order_date)
    -- against what was BILLED (sap_invoices.invoice_date), by month.
    -- Deliberately distinct from realizedVsPipelineData above, which is
    -- CRM-vs-SAP; this one never touches sales_leads at all, so a widening
    -- gap here is a fulfilment/invoicing-lag signal, not a CRM
    -- data-quality one.
    --
    -- Deliberately NOT bounded by p_start_date/p_end_date -- always the
    -- trailing 12 months (current month plus the 11 before it), same
    -- "always-on trend" convention as get_finance_dashboard's YoY/trend
    -- charts: a booking-to-billing lag is only legible across a fixed
    -- multi-month window, and a one-month page filter would collapse it to
    -- a single meaningless point.
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

    -- Invoiced / Collected / Budget (added 2026-07, invoice/budget/collected
    -- rebalance) -- monthly SAP invoiced revenue and cash collected against
    -- the manually-set monthly revenue budget (sales_budgets). The
    -- Forecast-2 pairing invoiceBudgetScorecardData shows per rep; this is
    -- the same story dept-wide, over time -- answers "are we tracking to
    -- budget month over month", which the scorecard's single collapsed
    -- period figure can't.
    --
    -- Period-bound by p_start_date/p_end_date (all-time when neither is
    -- set), same convention as realizedVsPipelineData above and
    -- get_finance_dashboard's revenueTrendData -- deliberately NOT the fixed
    -- trailing-12-month window bookingsVsInvoicedTrendData uses above. That
    -- one is fixed because a booking-to-billing LAG is only legible across a
    -- multi-month window; budget attainment is a plain period question and
    -- should follow the page's own date filter.
    --
    -- No proration here, unlike budget_math above: sales_budgets is already
    -- monthly-native (budget_month is a date, one row per rep per month), so
    -- a monthly trend reads it at its own native grain -- proration exists
    -- only to collapse those months into one arbitrary-length period. The
    -- budget side filters/groups on the month BUCKET (date_trunc'd), not the
    -- raw date, since nothing constrains budget_month to a first-of-month
    -- value.
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
        -- Reuses base_payment_apps (already materialized for this request),
        -- same window/shape as collected_kpis above, just bucketed monthly.
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

    'grossProfitByRepData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                sp.sales_rep_name as name,
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
            join sap_sales_persons sp on sp.sales_rep_code = oi.sales_rep_code
            where (p_start_date is null or oi."invoice_date"::date >= p_start_date)
              and (p_end_date is null or oi."invoice_date"::date <= p_end_date)
            group by sp.sales_rep_name
            order by revenue_myr desc
            limit 15
        ) x
    ),

    -- Pipeline stage funnel (added 2026-07, Sales Reports redesign) -- count
    -- and value per stage, mirroring get_sales_leads_dashboard's own
    -- stageData (same WON->actual_revenue / everything-else->expected_revenue
    -- value rule) so the Tier-2 and Tier-3 pages can never disagree on stage
    -- composition. Sourced from THIS RPC's base_leads, which already applies
    -- p_owner_id/p_product_type -- not by re-querying sales_leads directly.
    --
    -- Two deliberate deviations from the sibling RPC, both defect fixes, not
    -- stylistic:
    --   1. p_start_date/p_end_date are null-guarded independently below. The
    --      sibling gates its whole created_at/closed_date window on
    --      `p_start_date is null` alone, so a start-date-only filter makes
    --      every OR branch evaluate to NULL and silently returns []. That's
    --      reachable here -- the page's date-range filter renders two
    --      independent date inputs with no coupling between them.
    --   2. Funnel order is an explicit case expression, not `order by stage`.
    --      `order by stage` sorts by the sales_leads_stage enum's declaration
    --      order, which isn't defined anywhere in this repo and so can't be
    --      relied on to match DISCOVERY -> SAMPLE_TEST -> ... -> WON/LOST.
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

    -- Top customers by invoiced revenue (added 2026-07, invoice/budget/
    -- collected rebalance) -- SAP-sourced account-concentration basis,
    -- mirroring get_finance_dashboard_rpc.sql's topCustomersByRevenueData
    -- field for field (same base_invoices shape, same customer_code/
    -- customer_name grouping, same count(distinct doc_entry), same limit 10)
    -- so the two dashboards can never rank the same accounts differently.
    --
    -- "Customer" (SAP customer_code on sap_invoices), NOT "Client" (the
    -- CRM-native `clients` table used by topClientsData above) -- see
    -- DASHBOARD-CONVENTIONS.md's "Client vs Customer" rule. This RPC now
    -- legitimately returns both words, one per source table: topClientsData
    -- backs the CRM-side "Top Clients" chart (unchanged, kept as-is); this
    -- field backs the headline Customer Concentration tile (converted from
    -- CRM to SAP-invoiced per explicit product decision) and its own "Top
    -- Customers by Invoiced Revenue" chart.
    'topInvoicedCustomersData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                customer_code,
                customer_name,
                count(distinct doc_entry) as invoice_count,
                sum(total_amount_myr) as revenue_myr
            from base_invoices
            where (p_start_date is null or "invoice_date"::date >= p_start_date)
              and (p_end_date is null or "invoice_date"::date <= p_end_date)
            group by customer_code, customer_name
            order by revenue_myr desc
            limit 10
        ) x
    ),

    -- Top Products (added 2026-08) -- see base_invoice_lines above for the
    -- source/currency-conversion rationale (doc_myr_ratio, not the line's
    -- own exchange_rate -- fixed 2026-08, see that CTE's comment). Same
    -- shape as Operations' topUndeliveredItemsData
    -- (get_operations_dashboard_rpc.sql): item_code/item_name from
    -- sap_items, quantity_sold and revenue_myr summed per item, top 10 by
    -- revenue. "Invoice" tag (sap_invoice_lines) per
    -- DASHBOARD-CONVENTIONS.md's Source-labeling convention -- billed/actual,
    -- not booked (sap_sales_order_lines) and not the CRM product_type enum
    -- (productTypeData above).
    'topProductsData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
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
        ) x
    ),

    -- Revenue by product group (added 2026-09, Item Grouping) -- same
    -- base_invoice_lines source as topProductsData above (billed/invoiced,
    -- v_sales_rep_code-scoped for free), aggregated across ALL products per
    -- SAP item group (OITB) rather than just the top-10 individual products.
    -- See docs/sap-data-architecture-plans/09-item-grouping-execution-plan.md.
    'revenueByProductGroupData', (
        select coalesce(json_agg(x order by x.revenue_myr desc), '[]'::json)
        from (
            select
                coalesce(ig.group_name, 'Ungrouped') as item_group_name,
                sum(bil.quantity) as quantity_sold,
                sum(bil.line_total * bil.doc_myr_ratio) as revenue_myr
            from base_invoice_lines bil
            left join sap_items it on it.item_code = bil.item_code
            left join sap_item_groups ig on ig.group_code = it.item_group_code
            group by coalesce(ig.group_name, 'Ungrouped')
        ) x
    )

)
into result;

return result;

end;
$$;
