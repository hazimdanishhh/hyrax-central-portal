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

with closing_dates as (
    select lead_id, max(changed_at) as closed_date
    from sales_leads_stage_history
    where new_stage in ('WON', 'LOST')
    group by lead_id
),

base_leads as (
    select
        sl.*,
        coalesce(cd.closed_date, case when sl.stage in ('WON', 'LOST') or sl.is_cancelled then sl.updated_at else null end) as closed_date
    from sales_leads sl
    left join closing_dates cd on cd.lead_id = sl.id
    where (p_owner_id is null or sl.lead_owner_id = p_owner_id)
      and (p_product_type is null or sl.product_type = p_product_type)
),

base_invoices as (
    select oi.*
    from sap_invoices oi
    where oi.is_cancelled = 'N'
),

base_orders as (
    select so.*
    from sap_sales_orders so
    where so.is_cancelled = 'N'
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
    where (p_owner_id is null or t.lead_owner_id = p_owner_id)
),

-- Forecast 2: per-rep prorated invoice budget (identical proration formula,
-- keyed by sales_rep_code instead of lead_owner_id).
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
        ), 0) as total_collected
    from base_payment_apps
),

lead_kpis as (
    select
        coalesce(sum(actual_revenue) filter (
            where stage = 'WON'
            and (p_start_date is null or closed_date >= p_start_date)
            and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
        ), 0) as won_revenue,

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
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                c.name,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_revenue
            from base_leads fl
            join clients c on c.id = fl.client_id
            where not fl.is_cancelled
            group by c.name
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
    )

)
into result;

return result;

end;
$$;
