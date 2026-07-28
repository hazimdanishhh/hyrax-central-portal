create or replace function get_finance_dashboard(
    p_customer_code   text default null,
    p_sales_rep_code  bigint default null,
    p_start_date      date default null,
    p_end_date        date default null,
    p_is_cancelled    boolean default null,
    p_status_code     text default null,
    -- Added 2026-07 (Finance Expansion Phase 1) for the Accounts Payable
    -- chain -- filters base_bills/base_vendor_payments the same way
    -- p_customer_code filters the AR side. p_status_code is shared across
    -- both sides: OPCH's DocStatus uses the same 'O'/'C' convention as OINV.
    p_vendor_code     text default null
)
returns json
language plpgsql
-- Function-scoped GUC overrides (added 2026-07, post-Phase-2 fix): confirmed
-- live that this call was hitting Postgres error 57014 ("canceling statement
-- due to statement timeout") when invoked from the frontend via PostgREST's
-- API role (anon/authenticated) -- the SAME call finished in well under 10s
-- run directly in Supabase Studio's SQL editor, which uses an unrestricted
-- role with a much looser statement_timeout. The Finance Expansion Phase 2
-- GL rollout (WITH RECURSIVE chart-of-accounts walk + joins across
-- sap_gl_journal_lines/sap_gl_journal_entries, 620K+ rows combined and
-- growing daily) pushed a filterless dashboard load's execution time past
-- the API role's tighter ceiling. Scoped here (not via ALTER ROLE or a
-- project-wide setting) so it doesn't mask a genuinely runaway query on any
-- other RPC/role -- Postgres saves/restores the caller's real values around
-- just this one function call. Being part of this CREATE FUNCTION statement
-- itself (not a separate ALTER FUNCTION command run once by hand), these
-- survive every future hand-redeploy of this file -- don't strip them as
-- dead-looking config if you're copy-editing this header later.
set statement_timeout = '30s'
set work_mem = '64MB'
as
$$
declare
    result json;
    v_prev_start_date date;
    v_prev_end_date date;
    -- Added 2026-07 (YoY comparisons): same period one year back -- distinct
    -- from v_prev_start_date/v_prev_end_date above, which is the immediately
    -- preceding period of the same length (e.g. last month), not the same
    -- period last year. Null whenever no range is selected, same guard as
    -- v_prev_*.
    v_yoy_start_date date;
    v_yoy_end_date date;
    v_is_cancelled_text text;
    v_days numeric;
begin

-- 1. Calculate the Previous Period for Deltas (mirrors get_sales_leads_dashboard)
if p_start_date is not null and p_end_date is not null then
    v_prev_end_date := p_start_date - 1;
    v_prev_start_date := v_prev_end_date - (p_end_date - p_start_date);
    v_yoy_start_date := (p_start_date - interval '1 year')::date;
    v_yoy_end_date := (p_end_date - interval '1 year')::date;
    v_days := (p_end_date - p_start_date) + 1;
else
    v_days := 365; -- annualized default for DSO when no range is selected
end if;

-- Finance must never silently blend cancelled/voided SAP docs into revenue/AR.
-- null/false -> active docs only ('N'). true -> cancelled-only audit view ('Y').
v_is_cancelled_text := case when p_is_cancelled is true then 'Y' else 'N' end;

-- RECURSIVE (added 2026-07, Finance Expansion Phase 2): needed by
-- gl_account_ancestry_raw below, which walks sap_gl_accounts.father_code to
-- resolve each GL account's chart-of-accounts category. Every other CTE in
-- this WITH clause is plain (non-recursive) and is unaffected by this
-- keyword -- Postgres allows both to coexist in one WITH RECURSIVE block.
with recursive base_invoices as (
    select
        oi.*,
        -- Same GrosProfit outlier guard as salesRepRevenueData below and
        -- get_sales_reports_dashboard's grossProfitByRepData -- SAP's own GP
        -- field carries a known item-cost master-data defect at the extremes
        -- (legitimate gp/total_amount_myr ratios top out around 2.7x,
        -- defective rows run 900x-1000x+ in the same currency).
        case
            when oi.total_amount_myr <> 0
             and abs(oi.gross_profit) > abs(oi.total_amount_myr) * 5
            then null
            else oi.gross_profit
        end as gross_profit_sanitized
    from sap_invoices oi
    where oi.is_cancelled = v_is_cancelled_text
      and (p_customer_code  is null or oi.customer_code  = p_customer_code)
      and (p_sales_rep_code is null or oi.sales_rep_code = p_sales_rep_code)
      and (p_status_code    is null or oi.status_code    = p_status_code)
),

base_payments as (
    -- ORCT header only, used for unallocated_amount (no rep column on ORCT)
    select p.*
    from sap_payments p
    where p.is_cancelled = v_is_cancelled_text
      and (p_customer_code is null or p.customer_code = p_customer_code)
),

base_payment_apps as (
    -- THE RCT2 JOIN TRAP (corrected 2026-07): payment_ref -> sap_payments.doc_entry.
    -- NOT receipt_number: for receipts through 2024-12-19, doc_entry and
    -- receipt_number held the same value (old numbering series), which masked
    -- this for years. A new SAP numbering series activated 2024-12-20 made
    -- doc_entry diverge from receipt_number going forward, silently breaking
    -- any join on receipt_number for every receipt since. See
    -- hyrax-data-platform/docs/DATA-DICTIONARY.md's "RCT2 Join Trap" section.
    select
        pa.amount_applied_myr,
        p.payment_date,
        p.customer_code,
        i.sales_rep_code as invoice_sales_rep_code
    from sap_payment_applications pa
    join sap_payments p on pa.payment_ref = p.doc_entry
    -- CONFIRMED (updated 2026-07, was previously joined on inv_entry): doc_entry
    -- is the real FK to sap_invoices.doc_entry, but only when inv_type = 13 --
    -- doc_entry is a polymorphic FK whose target table depends on inv_type (14=
    -- credit memo, 18/19=A/P doc, 24=another payment/reconciliation, 203=down-
    -- payment invoice, others), none of which are extracted here except
    -- sap_invoices. See hyrax-data-platform/docs/DATA-DICTIONARY.md's "RCT2 ->
    -- invoice link" section. No DB-level FK constraint exists for this column
    -- (deliberately -- see infrastructure/supabase_sap_migration.sql), so this
    -- filter is the only enforcement; don't drop it.
    left join sap_invoices i on pa.doc_entry = i.doc_entry and pa.inv_type = 13
    where p.is_cancelled = v_is_cancelled_text
      and (p_customer_code  is null or p.customer_code = p_customer_code)
      and (p_sales_rep_code is null or i.sales_rep_code = p_sales_rep_code)
      -- Never blend cash applied against a since-cancelled invoice into an
      -- active-docs view (mirrors base_invoices' own is_cancelled filter --
      -- previously only the payment's own cancellation flag was checked
      -- here, letting cancelled-invoice payments still count toward
      -- totalCollected). Rows with no invoice match at all (i.doc_entry is
      -- null -- on-account cash, other inv_types) are unrelated to invoice
      -- cancellation and stay in either way.
      and (i.doc_entry is null or i.is_cancelled = v_is_cancelled_text)
      -- NOTE: when p_sales_rep_code is set, non-invoice rows (inv_type != 13,
      -- i.sales_rep_code null -- includes on-account cash and other document
      -- types) are correctly excluded -- unlinked/non-invoice cash can't be
      -- attributed to a rep.
),

-- ─── Accounts Payable chain (Finance Expansion Phase 1, added 2026-07) ──────
-- Mirrors base_invoices/base_payments/base_payment_apps above, field-for-field,
-- on the payables side. See infrastructure/ap_chain_migration.sql and
-- hyrax-data-platform/docs/sap-data-architecture-plans/
-- 06-finance-expansion-execution-plan.md for the full design.

base_bills as (
    -- OPCH (A/P Invoices / vendor bills) -- AP mirror of base_invoices. No
    -- rep/GP-guard analog needed here: OPCH carries no sales_rep_code, and
    -- its GrosProfit field isn't a meaningful AP concept.
    select b.*
    from sap_vendor_bills b
    where b.is_cancelled = v_is_cancelled_text
      and (p_vendor_code is null or b.vendor_code = p_vendor_code)
      and (p_status_code is null or b.status_code = p_status_code)
),

base_vendor_payments as (
    -- OVPM header only, used for unallocated_amount -- AP mirror of base_payments.
    select p.*
    from sap_vendor_payments p
    where p.is_cancelled = v_is_cancelled_text
      and (p_vendor_code is null or p.vendor_code = p_vendor_code)
),

base_vendor_payment_apps as (
    -- THE VPM2 JOIN TRAP -- AP mirror of the RCT2 join trap above, same
    -- polymorphic-FK pattern: payment_ref -> sap_vendor_payments.doc_entry;
    -- doc_entry -> sap_vendor_bills.doc_entry only when doc_type = 18 (OPCH),
    -- other doc_type values (19 = ORPC A/P credit memo, others) point at
    -- document types not extracted here. No DB-level FK constraint exists on
    -- this column (deliberately -- see infrastructure/ap_chain_migration.sql),
    -- so this filter is the only enforcement; don't drop it. No sales-rep
    -- attribution exists on the AP side (vendors aren't reps), so unlike
    -- base_payment_apps this doesn't need a rep-code passthrough column.
    select
        pa.amount_applied_myr,
        p.payment_date,
        p.vendor_code
    from sap_vendor_payment_applications pa
    join sap_vendor_payments p on pa.payment_ref = p.doc_entry
    left join sap_vendor_bills bl on pa.doc_entry = bl.doc_entry and pa.doc_type = 18
    where p.is_cancelled = v_is_cancelled_text
      and (p_vendor_code is null or p.vendor_code = p_vendor_code)
      -- Mirrors base_payment_apps' cancelled-invoice guard: never blend cash
      -- paid against a since-cancelled bill into an active-docs view.
      and (bl.doc_entry is null or bl.is_cancelled = v_is_cancelled_text)
),

-- ─── General Ledger (Finance Expansion Phase 2, added 2026-07) ──────────────
-- Confirmed live against Hyrax's actual chart of accounts (not a hypothesis):
--   Level-2 categories -- 100=Fixed Asset, 200=Current Asset (both under
--   drawer 1/Assets); 300=Current Liabilities (the SOLE Level-2 node under
--   drawer 2/Liabilities -- Hyrax has no long-term-liability category
--   today); 400=Equity, 500=Turnover, 600=Cost Of Sales, 700=Expenses,
--   800=Other Expenditure (one Level-2 node per drawer 3-7). Drawer 8
--   (Taxation) has no confirmed activity in Hyrax's live data.
--   Level-3 -- 2000=Inventories, 2400=Prepayment (both under Current
--   Asset/200, needed to exclude from Quick Ratio); 7200=Financial Related
--   (under Expenses/700, holds every interest/bank-charge line item,
--   needed for the EBITDA interest add-back).
--   AcctCode is NOT a reliable textual prefix for any of this (confirmed
--   live: account '6200260' sits under GroupMask=5/Cost-Of-Sales despite
--   its "62..." prefix visually suggesting a "620x" grouping) -- always
--   resolve category via the real father_code chain below, never by
--   guessing from account_code text.
--   Sign convention (confirmed live via a balance-sheet identity check:
--   Assets + Liabilities + Equity summed to within ~RM205K of zero, the
--   expected un-closed-current-year-earnings residual): sap_gl_accounts.
--   current_balance_myr is uniformly debit-positive -- Assets (debit-normal)
--   store positive as-is; Liabilities/Equity/Revenue (credit-normal) store
--   NEGATIVE, and must be negated below to report a human-readable positive
--   amount. Don't drop these negations; getting this wrong produces a
--   negative or nonsensical ratio, not an obviously-broken one.

gl_account_ancestry_raw as (
    select account_code, father_code, level, account_code as leaf_code
    from sap_gl_accounts
    where is_postable = 'Y'

    union all

    select p.account_code, p.father_code, p.level, r.leaf_code
    from sap_gl_accounts p
    join gl_account_ancestry_raw r on p.account_code = r.father_code
),

gl_account_ancestry as (
    -- One row per postable (leaf) account, tagging its Level-2 and Level-3
    -- ancestor codes (see the category note above).
    select
        leaf_code,
        max(case when level = 2 then account_code end) as level2_ancestor,
        max(case when level = 3 then account_code end) as level3_ancestor
    from gl_account_ancestry_raw
    group by leaf_code
),

gl_balance_sheet as (
    -- Point-in-time (as of today) balance per postable account, classified
    -- via the ancestry walk above. Uses sap_gl_accounts.current_balance_myr
    -- (SAP's own maintained running balance) rather than summing all of
    -- sap_gl_journal_lines since inception -- mirrors this RPC's existing
    -- "trust SAP's own maintained aggregate" pattern for outstanding_ar
    -- (sap_invoices.paid_to_date).
    select
        a.account_code,
        a.drawer,
        a.current_balance_myr,
        anc.level2_ancestor,
        anc.level3_ancestor
    from sap_gl_accounts a
    join gl_account_ancestry anc on anc.leaf_code = a.account_code
    where a.is_postable = 'Y'
),

base_gl_lines as (
    -- Period P&L activity, read from mv_gl_monthly_account_summary (added
    -- 2026-07, see infrastructure/gl_monthly_summary_migration.sql) instead
    -- of a live join across sap_gl_journal_lines/sap_gl_journal_entries/
    -- sap_gl_accounts -- that live join (467K + 156K rows, unconditionally
    -- full history on every single call, since the date filter only
    -- decides which rows count toward the sums, not how much gets
    -- scanned/joined) was still costing 10s+ even after this CTE's own
    -- kpi_totals consumers were rewritten to single-pass FILTER aggregates.
    -- The materialized view pre-joins/pre-aggregates to (month,
    -- account_code) grain -- a few thousand rows instead of hundreds of
    -- thousands -- refreshed by ingestion/sap_supabase/src/extractors/
    -- gl_journal.py right after each GL pipeline run, not on a schedule.
    --
    -- Column contract below is UNCHANGED from the old live-join version, so
    -- nothing downstream (gl_agg, plTrendData, opexBreakdownData,
    -- plYoyTrendData) needed to change.
    --
    -- Known tradeoff: posting_date is now month-truncated (first-of-month),
    -- not the exact day -- a custom date range that doesn't land on a month
    -- boundary rounds to whole months for GL figures specifically (AR/AP
    -- figures are untouched). Fine in practice: the only real filter UI
    -- here is the Fiscal Year preset (April-March, always month-aligned).
    --
    -- trans_type <> '-3' (SAP Business One's reserved period-end-closing
    -- system code -- see the execution plan doc's Phase 2 follow-up notes
    -- for the live-confirmed diagnosis) is now excluded inside the
    -- materialized view itself, not here.
    --
    -- Reads private.mv_gl_monthly_account_summary, not public (added
    -- 2026-07, see infrastructure/gl_monthly_summary_private_schema_
    -- migration.sql): Supabase's linter flagged the view for being directly
    -- reachable via the REST API from the public schema, bypassing the
    -- app-level access gating -- nothing but this RPC ever needed to read
    -- it. This function stays SECURITY INVOKER; the private schema isn't in
    -- PostgREST's exposed-schemas list, so it isn't routable via the API at
    -- all, regardless of the grants that let this function's own query
    -- still succeed.
    select
        account_code,
        debit_amount_myr,
        credit_amount_myr,
        month as posting_date,
        drawer,
        account_name
    from private.mv_gl_monthly_account_summary
),

-- Performance rewrite (added 2026-07): kpi_totals used to compute every field
-- below as its own independent correlated subquery (~35 of them), each one
-- re-scanning the same materialized base_* CTE from scratch -- e.g. 8 separate
-- passes over base_gl_lines alone. That's what pushed a filterless dashboard
-- load to 20-25s even after the statement_timeout fix above. Rewritten as one
-- single-pass aggregate CTE per base table, using `filter (where ...)` per
-- column instead of N subqueries -- the same pattern get_sales_leads_dashboard_
-- rpc.sql/get_sales_reports_dashboard_rpc.sql already use for their own kpis
-- blocks. Every field name and formula below is unchanged from the original;
-- only the query *shape* changed. The final kpi_totals CTE cross-joins these
-- single-row aggregates back together so every existing `from kpi_totals`
-- reference elsewhere in this function needs no changes.

invoices_agg as (
    select
        coalesce(sum(total_amount_myr) filter (where
            (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date is null or "invoice_date"::date <= p_end_date)
        ), 0) as period_invoiced,

        count(*) filter (where
            (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date is null or "invoice_date"::date <= p_end_date)
        ) as period_invoice_count,

        -- NOTE: outstanding_ar is sourced straight from sap_invoices.paid_to_date
        -- (SAP's own native per-invoice running total -- OINV.PaidToDate), with
        -- no RCT2/payment-applications join involved at all. period_collected
        -- (payment_apps_agg below), by contrast, comes from base_payment_apps
        -- (RCT2), which can only attribute inv_type=13 rows. These two numbers
        -- measure "money paid" via two different SAP sources, so period_invoiced
        -- - period_collected will NOT generally equal outstanding_ar, even with
        -- no date filter applied -- that gap reflects real cash that settled
        -- invoices through a document type the RCT2 join can't see (on-account
        -- cash, credit memos, etc.), not an error in either figure. See
        -- hyrax-central-portal/docs/RPC-REFERENCE.md's Finance section.
        coalesce(sum(total_amount_myr - paid_to_date) filter (where status_code = 'O'), 0) as outstanding_ar,

        count(*) filter (where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ) as overdue_count,

        coalesce(sum(total_amount_myr - paid_to_date) filter (where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ), 0) as overdue_value,

        (case when p_start_date is null then null else
            coalesce(sum(total_amount_myr) filter (where "invoice_date"::date between v_prev_start_date and v_prev_end_date), 0)
         end) as prev_period_invoiced,

        -- Gross Profit -- SAP's own pre-computed GrosProfit line-item field
        -- (via gross_profit_sanitized's outlier guard above), summed the
        -- same way/scope as period_invoiced. Maps to the target KPI
        -- framework's "Gross Profit Margin" (see
        -- hyrax-data-platform/docs/sap-data-architecture-plans/
        -- 02-department-kpi-frameworks.md) -- SAP already computes GrosProfit
        -- per line, so no separate COGS derivation is needed here.
        coalesce(sum(gross_profit_sanitized) filter (where
            (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date is null or "invoice_date"::date <= p_end_date)
        ), 0) as period_gross_profit,

        (case when p_start_date is null then null else
            coalesce(sum(gross_profit_sanitized) filter (where "invoice_date"::date between v_prev_start_date and v_prev_end_date), 0)
         end) as prev_period_gross_profit,

        -- YoY (added 2026-07): same period one year back, distinct from
        -- prev_period_* above (immediately preceding period, not same period
        -- last year) -- see v_yoy_start_date/v_yoy_end_date's declaration.
        (case when p_start_date is null then null else
            coalesce(sum(total_amount_myr) filter (where "invoice_date"::date between v_yoy_start_date and v_yoy_end_date), 0)
         end) as yoy_period_invoiced,

        (case when p_start_date is null then null else
            coalesce(sum(gross_profit_sanitized) filter (where "invoice_date"::date between v_yoy_start_date and v_yoy_end_date), 0)
         end) as yoy_period_gross_profit
    from base_invoices
),

payment_apps_agg as (
    select
        coalesce(sum(amount_applied_myr) filter (where
            (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date is null or payment_date::date <= p_end_date)
        ), 0) as period_collected,

        (case when p_start_date is null then null else
            coalesce(sum(amount_applied_myr) filter (where payment_date::date between v_prev_start_date and v_prev_end_date), 0)
         end) as prev_period_collected
    from base_payment_apps
),

payments_agg as (
    select
        coalesce(sum(unallocated_amount) filter (where
            (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date is null or payment_date::date <= p_end_date)
        ), 0) as unallocated_payments
    from base_payments
),

-- ─── Accounts Payable chain totals (Finance Expansion Phase 1) ──────
-- Mirrors invoices_agg/payment_apps_agg/payments_agg above, field-for-field,
-- on the payables side.

bills_agg as (
    select
        coalesce(sum(total_amount_myr) filter (where
            (p_start_date is null or "bill_date"::date >= p_start_date)
            and (p_end_date is null or "bill_date"::date <= p_end_date)
        ), 0) as period_billed,

        count(*) filter (where
            (p_start_date is null or "bill_date"::date >= p_start_date)
            and (p_end_date is null or "bill_date"::date <= p_end_date)
        ) as period_bill_count,

        -- Same sourcing caveat as outstanding_ar: straight from
        -- sap_vendor_bills.paid_to_date, no VPM2 join involved -- won't
        -- generally reconcile exactly against period_billed - period_paid,
        -- for the same reason outstandingAR doesn't reconcile against
        -- periodInvoicedRevenue - totalCollected (see that comment above).
        coalesce(sum(total_amount_myr - paid_to_date) filter (where status_code = 'O'), 0) as outstanding_ap,

        count(*) filter (where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ) as overdue_bill_count,

        coalesce(sum(total_amount_myr - paid_to_date) filter (where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ), 0) as overdue_bill_value,

        (case when p_start_date is null then null else
            coalesce(sum(total_amount_myr) filter (where "bill_date"::date between v_prev_start_date and v_prev_end_date), 0)
         end) as prev_period_billed
    from base_bills
),

vendor_payment_apps_agg as (
    select
        coalesce(sum(amount_applied_myr) filter (where
            (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date is null or payment_date::date <= p_end_date)
        ), 0) as period_paid,

        (case when p_start_date is null then null else
            coalesce(sum(amount_applied_myr) filter (where payment_date::date between v_prev_start_date and v_prev_end_date), 0)
         end) as prev_period_paid
    from base_vendor_payment_apps
),

vendor_payments_agg as (
    select
        coalesce(sum(unallocated_amount) filter (where
            (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date is null or payment_date::date <= p_end_date)
        ), 0) as unallocated_outgoing_payments
    from base_vendor_payments
),

-- ─── General Ledger P&L (period-bound, Finance Expansion Phase 2) ───
-- Revenue/Equity-drawer accounts are credit-normal (credit - debit);
-- Cost/Expense-drawer accounts are debit-normal (debit - credit) --
-- standard double-entry sign convention, applied per drawer. The
-- gl_account_ancestry join (needed only for gl_period_interest's "7200"
-- lookup) is folded into this same single pass rather than its own separate
-- scan -- a left join since every leaf account should resolve to an
-- ancestor, but this way a non-matching row just falls out of the interest
-- filter instead of the whole aggregate silently excluding it.
gl_agg as (
    select
        coalesce(sum(credit_amount_myr - debit_amount_myr) filter (where drawer = 4
            and (p_start_date is null or bl.posting_date::date >= p_start_date)
            and (p_end_date is null or bl.posting_date::date <= p_end_date)
        ), 0) as gl_period_revenue,

        coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 5
            and (p_start_date is null or bl.posting_date::date >= p_start_date)
            and (p_end_date is null or bl.posting_date::date <= p_end_date)
        ), 0) as gl_period_cogs,

        coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 6
            and (p_start_date is null or bl.posting_date::date >= p_start_date)
            and (p_end_date is null or bl.posting_date::date <= p_end_date)
        ), 0) as gl_period_opex,

        coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 7
            and (p_start_date is null or bl.posting_date::date >= p_start_date)
            and (p_end_date is null or bl.posting_date::date <= p_end_date)
        ), 0) as gl_period_other_expenditure,

        coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 8
            and (p_start_date is null or bl.posting_date::date >= p_start_date)
            and (p_end_date is null or bl.posting_date::date <= p_end_date)
        ), 0) as gl_period_tax,

        -- Interest -- structural, not name-based: everything under the
        -- "7200 Financial Related" Level-3 node (confirmed live -- this
        -- subtree holds every interest/bank-charge line item Hyrax books,
        -- including a couple of interest-income lines netted in by their own
        -- chart-of-accounts design). Already counted inside gl_period_opex
        -- above (drawer 6) -- adding it back for EBITDA below reverses
        -- exactly that effect on net profit, it isn't a double-count.
        coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where anc.level3_ancestor = '7200'
            and (p_start_date is null or bl.posting_date::date >= p_start_date)
            and (p_end_date is null or bl.posting_date::date <= p_end_date)
        ), 0) as gl_period_interest,

        -- Depreciation/Amortization -- name-pattern match, NOT structural.
        -- Hyrax's chart of accounts splits D&A across two different drawers
        -- depending on asset type (confirmed live: "Depreciation - Plant &
        -- Mach" sits under Cost Of Sales/drawer 5, plain "Depreciation" sits
        -- under Other Expenditure/drawer 7) -- there's no single clean
        -- structural home for it the way Interest has "7200". Less robust
        -- than every other GL figure here: a renamed or newly-added D&A
        -- account with different wording would silently fall through this
        -- filter. Revisit if this proves materially wrong against a real
        -- P&L review.
        coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where
            (bl.account_name ilike '%depreciation%' or bl.account_name ilike '%amorti%')
            and (p_start_date is null or bl.posting_date::date >= p_start_date)
            and (p_end_date is null or bl.posting_date::date <= p_end_date)
        ), 0) as gl_period_depreciation_amortization,

        (case when p_start_date is null then null else
            coalesce(sum(credit_amount_myr - debit_amount_myr) filter (where drawer = 4 and bl.posting_date::date between v_prev_start_date and v_prev_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 5 and bl.posting_date::date between v_prev_start_date and v_prev_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 6 and bl.posting_date::date between v_prev_start_date and v_prev_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 7 and bl.posting_date::date between v_prev_start_date and v_prev_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 8 and bl.posting_date::date between v_prev_start_date and v_prev_end_date), 0)
         end) as prev_net_profit,

        -- YoY (added 2026-07): same 5-drawer combined expression as
        -- prev_net_profit above, windowed a year back instead of one period back.
        (case when p_start_date is null then null else
            coalesce(sum(credit_amount_myr - debit_amount_myr) filter (where drawer = 4 and bl.posting_date::date between v_yoy_start_date and v_yoy_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 5 and bl.posting_date::date between v_yoy_start_date and v_yoy_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 6 and bl.posting_date::date between v_yoy_start_date and v_yoy_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 7 and bl.posting_date::date between v_yoy_start_date and v_yoy_end_date), 0)
          - coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 8 and bl.posting_date::date between v_yoy_start_date and v_yoy_end_date), 0)
         end) as yoy_net_profit
    from base_gl_lines bl
    left join gl_account_ancestry anc on anc.leaf_code = bl.account_code
),

-- ─── Balance Sheet (point-in-time, "as of today") ───────────────────
-- Liabilities/Equity negated -- see the sign-convention note above
-- base_gl_lines; current_balance_myr stores them as negative.
gl_balance_agg as (
    select
        coalesce(sum(current_balance_myr) filter (where drawer = 1 and level2_ancestor = '200'), 0) as current_assets,

        coalesce(sum(current_balance_myr) filter (where drawer = 1 and level2_ancestor = '100'), 0) as fixed_assets,

        -coalesce(sum(current_balance_myr) filter (where drawer = 2 and level2_ancestor = '300'), 0) as current_liabilities,

        -- Computed independently from current_liabilities (not just aliased
        -- to it) so this stays correct if a long-term-liability category is
        -- ever added to Hyrax's chart of accounts -- today drawer 2 has only
        -- the one Level-2 node (300), so the two figures are identical.
        -coalesce(sum(current_balance_myr) filter (where drawer = 2), 0) as total_liabilities,

        -coalesce(sum(current_balance_myr) filter (where drawer = 3), 0) as total_equity,

        coalesce(sum(current_balance_myr) filter (where level3_ancestor = '2000'), 0) as gl_inventory_balance,

        coalesce(sum(current_balance_myr) filter (where level3_ancestor = '2400'), 0) as gl_prepayment_balance
    from gl_balance_sheet
),

kpi_totals as (
    select *
    from invoices_agg, payment_apps_agg, payments_agg,
         bills_agg, vendor_payment_apps_agg, vendor_payments_agg,
         gl_agg, gl_balance_agg
),

-- Per-rep cash collected, same period-bound rule as kpi_totals.period_collected
-- above -- feeds salesRepRevenueData only. Reps whose applied payments don't
-- resolve to an inv_type=13 invoice (on-account cash, other doc types --
-- see base_payment_apps above) are legitimately absent here, not a bug.
rep_collected_actuals as (
    select
        invoice_sales_rep_code as sales_rep_code,
        coalesce(sum(amount_applied_myr), 0) as collected_myr
    from base_payment_apps
    where invoice_sales_rep_code is not null
      and (p_start_date is null or payment_date::date >= p_start_date)
      and (p_end_date   is null or payment_date::date <= p_end_date)
    group by invoice_sales_rep_code
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'periodInvoicedRevenue', period_invoiced,
            'periodInvoiceCount',    period_invoice_count,
            'totalCollected',        period_collected,
            'outstandingAR',         outstanding_ar,
            'overdueInvoiceCount',   overdue_count,
            'overdueValue',          overdue_value,
            'unallocatedPayments',   unallocated_payments,
            -- DSO reconciled 2026-07: this was a point-in-time snapshot
            -- (outstanding_ar / period_invoiced), which disagreed with the
            -- classic average-AR formula recommended in
            -- hyrax-data-platform/docs/sap-data-architecture-plans/
            -- 02-department-kpi-frameworks.md. Now uses that formula:
            -- DSO = (Avg AR / Period Invoiced) * days, Avg AR = (Beginning
            -- AR + Ending AR) / 2. No historical AR snapshot exists, so
            -- Beginning AR is derived from the accounting identity
            -- Beginning = Ending - Invoiced + Collected -- valid since
            -- nothing else moves the AR balance today (no credit
            -- memos/write-offs: returns and GL aren't extracted yet).
            -- Clamped at 0: a slow-invoicing period with heavy collections
            -- against older, pre-period invoices can otherwise imply a
            -- nonsensical negative Beginning AR.
            -- Caveat carried over from outstanding_ar itself: Ending AR
            -- here is "as of today" (same convention as outstandingAR/
            -- arAgingData elsewhere in this RPC), not strictly "as of
            -- p_end_date" -- fine for the common case of a period ending
            -- at/near today, less precise for a period selected entirely
            -- in the past.
            -- With no date range selected, period_invoiced is all-time
            -- invoiced (dwarfing any AR balance), so Beginning AR clamps to
            -- 0 and this degrades gracefully to Avg AR = outstanding_ar / 2
            -- against the v_days = 365 annualized default below.
            'dso', case when period_invoiced > 0
                        then round(
                            (
                                (greatest(outstanding_ar - period_invoiced + period_collected, 0) + outstanding_ar)
                                / 2.0
                            ) / period_invoiced * v_days
                        , 1)
                        else 0 end,
            'collectionRatePct', case when period_invoiced > 0
                        then round((period_collected / period_invoiced) * 100, 1)
                        else 0 end,
            'periodGrossProfit', period_gross_profit,
            'grossProfitMarginPct', case when period_invoiced > 0
                        then round((period_gross_profit / period_invoiced) * 100, 1)
                        else 0 end,
            'prevPeriodInvoicedRevenue', prev_period_invoiced,
            'prevTotalCollected',        prev_period_collected,
            'prevPeriodGrossProfit',     prev_period_gross_profit,
            -- YoY (added 2026-07): same period one year back, distinct from
            -- prevPeriod* above (immediately preceding period, not same
            -- period last year) -- see v_yoy_start_date/v_yoy_end_date.
            'yoyPeriodInvoicedRevenue',  yoy_period_invoiced,
            'yoyPeriodGrossProfit',      yoy_period_gross_profit,

            -- ─── Accounts Payable chain (Finance Expansion Phase 1, 2026-07) ─
            'periodBilled',      period_billed,
            'periodBillCount',   period_bill_count,
            'totalPaid',         period_paid,
            'outstandingAP',     outstanding_ap,
            'overdueBillCount',  overdue_bill_count,
            'overdueBillValue',  overdue_bill_value,
            'unallocatedOutgoingPayments', unallocated_outgoing_payments,
            -- DPO uses the same average-AP methodology as the reconciled DSO
            -- formula above (Beginning AP derived via the accounting identity
            -- Beginning = Ending - Billed + Paid, clamped at 0, since no
            -- historical AP snapshot exists) -- launched consistent from day
            -- one rather than starting with a point-in-time shortcut like the
            -- original DSO did.
            'dpo', case when period_billed > 0
                        then round(
                            (
                                (greatest(outstanding_ap - period_billed + period_paid, 0) + outstanding_ap)
                                / 2.0
                            ) / period_billed * v_days
                        , 1)
                        else 0 end,
            -- Net AR/AP position -- a subledger-level signal (AR from
            -- sap_invoices, AP from sap_vendor_bills), kept alongside the
            -- real GL-based workingCapital figure below (added in this same
            -- Phase 2 update) rather than replaced by it: the two are
            -- related but structurally different measures (subledger
            -- receivables/payables vs. full current-assets/current-
            -- liabilities from the general ledger) and won't generally
            -- match exactly, for the same "two sources, don't silently pick
            -- a winner" reason documented throughout this RPC.
            'netArApPosition', outstanding_ar - outstanding_ap,
            'prevPeriodBilled', prev_period_billed,
            'prevTotalPaid',    prev_period_paid,

            -- ─── General Ledger (Finance Expansion Phase 2, 2026-07) ────────
            -- glGrossProfit/glGrossProfitMarginPct are a SEPARATE figure from
            -- periodGrossProfit/grossProfitMarginPct above -- that one sums
            -- SAP's own per-invoice GrosProfit field (AR/invoice-line level);
            -- this one derives Revenue-COGS from actual GL postings. Same
            -- "two systems, two sources, don't silently pick a winner"
            -- treatment already applied elsewhere in this RPC (see the
            -- Revenue-ownership split note on salesRepRevenueData) -- the two
            -- may not reconcile exactly, and that's expected, not a bug.
            'glPeriodRevenue',  gl_period_revenue,
            'glPeriodCOGS',     gl_period_cogs,
            'glGrossProfit',    gl_period_revenue - gl_period_cogs,
            'glGrossProfitMarginPct', case when gl_period_revenue > 0
                        then round(((gl_period_revenue - gl_period_cogs) / gl_period_revenue) * 100, 1)
                        else 0 end,
            'glOperatingExpenses', gl_period_opex,
            'glOperatingProfit', (gl_period_revenue - gl_period_cogs) - gl_period_opex,
            'glOtherExpenditure', gl_period_other_expenditure,
            'glTax', gl_period_tax,
            'netProfit', ((gl_period_revenue - gl_period_cogs) - gl_period_opex) - gl_period_other_expenditure - gl_period_tax,
            'netProfitMarginPct', case when gl_period_revenue > 0
                        then round(
                            ((((gl_period_revenue - gl_period_cogs) - gl_period_opex) - gl_period_other_expenditure - gl_period_tax) / gl_period_revenue) * 100
                        , 1)
                        else 0 end,
            -- EBITDA = Net Profit + Interest + Tax + Depreciation/Amortization
            -- added back. See gl_period_interest/gl_period_depreciation_
            -- amortization's own derivation comments above (kpi_totals) for
            -- exactly how robust each add-back is -- Interest is structural
            -- (the "7200 Financial Related" subtree), Depreciation/
            -- Amortization is name-pattern-based and the least robust figure
            -- in this whole RPC. Treat ebitda as a best-effort approximation,
            -- not a fully audited figure.
            'ebitda',
                (((gl_period_revenue - gl_period_cogs) - gl_period_opex) - gl_period_other_expenditure - gl_period_tax)
                + gl_period_interest + gl_period_tax + gl_period_depreciation_amortization,
            'ebitdaMarginPct', case when gl_period_revenue > 0
                        then round(
                            (
                                (
                                    (((gl_period_revenue - gl_period_cogs) - gl_period_opex) - gl_period_other_expenditure - gl_period_tax)
                                    + gl_period_interest + gl_period_tax + gl_period_depreciation_amortization
                                ) / gl_period_revenue
                            ) * 100
                        , 1)
                        else 0 end,
            'prevNetProfit', prev_net_profit,
            -- YoY (added 2026-07): same 5-drawer combined expression as
            -- prevNetProfit above, windowed a year back instead of one
            -- period back.
            'yoyNetProfit', yoy_net_profit,

            -- Balance sheet (point-in-time, "as of today", same convention as
            -- outstandingAR/outstandingAP above).
            'currentAssets', current_assets,
            'fixedAssets', fixed_assets,
            'totalAssets', current_assets + fixed_assets,
            'currentLiabilities', current_liabilities,
            'totalLiabilities', total_liabilities,
            'totalEquity', total_equity,
            'currentRatio', case when current_liabilities > 0
                        then round(current_assets / current_liabilities, 2)
                        else null end,
            -- Quick Assets = Current Assets minus Inventories and Prepayment
            -- (the standard Quick Ratio exclusions) -- both are Level-3
            -- categories confirmed live under Current Asset/200 (Inventories
            -- = 2000, Prepayment = 2400).
            'quickRatio', case when current_liabilities > 0
                        then round((current_assets - gl_inventory_balance - gl_prepayment_balance) / current_liabilities, 2)
                        else null end,
            'workingCapital', current_assets - current_liabilities
        )
        from kpi_totals
    ),

    -- Always "as of today" -- intentionally NOT bounded by p_start_date/p_end_date,
    -- since aging/outstanding balances are point-in-time, not period flows.
    'arAgingData', (
        select coalesce(json_agg(x order by x.bucket_order), '[]'::json)
        from (
            select
                case
                    when current_date - "due_date"::date <= 0 then 'Current'
                    when current_date - "due_date"::date <= 30 then '1-30'
                    when current_date - "due_date"::date <= 60 then '31-60'
                    when current_date - "due_date"::date <= 90 then '61-90'
                    else '90+'
                end as bucket,
                case
                    when current_date - "due_date"::date <= 0 then 1
                    when current_date - "due_date"::date <= 30 then 2
                    when current_date - "due_date"::date <= 60 then 3
                    when current_date - "due_date"::date <= 90 then 4
                    else 5
                end as bucket_order,
                count(*) as invoice_count,
                sum(total_amount_myr - paid_to_date) as outstanding_myr
            from base_invoices
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
            group by 1, 2
        ) x
    ),

    'revenueTrendData', (
        with invoiced_by_month as (
            select
                date_trunc('month', "invoice_date"::date) as month,
                sum(total_amount_myr) as invoiced_myr
            from base_invoices
            where (p_start_date is null or "invoice_date"::date >= p_start_date)
              and (p_end_date   is null or "invoice_date"::date <= p_end_date)
            group by 1
        ),
        collected_by_month as (
            select
                date_trunc('month', payment_date::date) as month,
                sum(amount_applied_myr) as collected_myr
            from base_payment_apps
            where (p_start_date is null or payment_date::date >= p_start_date)
              and (p_end_date   is null or payment_date::date <= p_end_date)
            group by 1
        )
        select coalesce(json_agg(json_build_object(
            'period', to_char(coalesce(im.month, cm.month), 'YYYY-MM'),
            'invoiced_myr', coalesce(im.invoiced_myr, 0),
            'collected_myr', coalesce(cm.collected_myr, 0)
        ) order by coalesce(im.month, cm.month)), '[]'::json)
        from invoiced_by_month im
        full outer join collected_by_month cm on cm.month = im.month
    ),

    'topOverdueCustomersData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                customer_code,
                customer_name,
                count(*) as overdue_invoice_count,
                sum(total_amount_myr - paid_to_date) as outstanding_myr,
                min("due_date"::date) as oldest_due_date
            from base_invoices
            where status_code = 'O' and "due_date"::date < current_date
              and (total_amount_myr - paid_to_date) > 0.01
            group by customer_code, customer_name
            order by outstanding_myr desc
            limit 10
        ) x
    ),

    -- Finance's own rep breakdown: invoiced revenue + cash collected (AR/cash
    -- concerns), NOT order-booked value -- that's Sales Reports' concern (see
    -- get_sales_reports_dashboard_rpc.sql's invoiceBudgetScorecardData /
    -- orderBookData). invoiced_revenue here is computed identically to that
    -- RPC's rep_invoice_actuals/grossProfitByRepData (same base_invoices
    -- CTE shape, same invoice_date scoping), so the two dashboards agree on
    -- invoiced revenue per rep by construction -- see
    -- hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §5.
    'salesRepRevenueData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                sp.sales_rep_code,
                sp.sales_rep_name,
                count(distinct bi.doc_entry) as invoice_count,
                coalesce(sum(bi.total_amount_myr), 0) as revenue_myr,
                coalesce(sum(bi.gross_profit_sanitized), 0) as gross_profit_myr,
                case when coalesce(sum(bi.total_amount_myr),0) > 0
                     then round((coalesce(sum(bi.gross_profit_sanitized),0) / sum(bi.total_amount_myr)) * 100, 1)
                     else 0 end as gp_pct,
                -- Cash actually collected against this rep's invoices in the
                -- period -- see rep_collected_actuals above for the on-account
                -- caveat. 0/absent here can be a real data-coverage gap, not
                -- necessarily a bug; cross-check against kpis.totalCollected.
                coalesce(max(rca.collected_myr), 0) as collected_myr
            from base_invoices bi
            join sap_sales_persons sp on sp.sales_rep_code = bi.sales_rep_code
            left join rep_collected_actuals rca on rca.sales_rep_code = bi.sales_rep_code
            where (p_start_date is null or bi."invoice_date"::date >= p_start_date)
              and (p_end_date   is null or bi."invoice_date"::date <= p_end_date)
            group by sp.sales_rep_code, sp.sales_rep_name
            order by revenue_myr desc
            limit 15
        ) x
    ),

    'topCustomersByRevenueData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                customer_code,
                customer_name,
                count(distinct doc_entry) as invoice_count,
                sum(total_amount_myr) as revenue_myr
            from base_invoices
            where (p_start_date is null or "invoice_date"::date >= p_start_date)
              and (p_end_date   is null or "invoice_date"::date <= p_end_date)
            group by customer_code, customer_name
            order by revenue_myr desc
            limit 10
        ) x
    ),

    -- Gives the existing "unallocatedPayments" KPI tile a drill-down list --
    -- who's actually sitting on unapplied cash. Always "as of today", same
    -- as AR aging (not bounded by p_start_date/p_end_date).
    'unallocatedPaymentsData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                customer_code,
                customer_name,
                payment_date,
                unallocated_amount
            from base_payments
            where unallocated_amount > 0.01
            order by unallocated_amount desc
            limit 10
        ) x
    ),

    -- AP Aging (Finance Expansion Phase 1, 2026-07): was a null contract
    -- placeholder pending OPCH/PCH1/OVPM/VPM2 extraction -- now real data,
    -- same 5-bucket shape as arAgingData above. Always "as of today", same
    -- as arAgingData (ignores the date filter -- aging is a snapshot
    -- balance, not a period flow).
    'apAgingData', (
        select coalesce(json_agg(x order by x.bucket_order), '[]'::json)
        from (
            select
                case
                    when current_date - "due_date"::date <= 0 then 'Current'
                    when current_date - "due_date"::date <= 30 then '1-30'
                    when current_date - "due_date"::date <= 60 then '31-60'
                    when current_date - "due_date"::date <= 90 then '61-90'
                    else '90+'
                end as bucket,
                case
                    when current_date - "due_date"::date <= 0 then 1
                    when current_date - "due_date"::date <= 30 then 2
                    when current_date - "due_date"::date <= 60 then 3
                    when current_date - "due_date"::date <= 90 then 4
                    else 5
                end as bucket_order,
                count(*) as bill_count,
                sum(total_amount_myr - paid_to_date) as outstanding_myr
            from base_bills
            where status_code = 'O' and (total_amount_myr - paid_to_date) > 0.01
            group by 1, 2
        ) x
    ),

    'topOverdueVendorsData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                vendor_code,
                vendor_name,
                count(*) as overdue_bill_count,
                sum(total_amount_myr - paid_to_date) as outstanding_myr,
                min("due_date"::date) as oldest_due_date
            from base_bills
            where status_code = 'O' and "due_date"::date < current_date
              and (total_amount_myr - paid_to_date) > 0.01
            group by vendor_code, vendor_name
            order by outstanding_myr desc
            limit 10
        ) x
    ),

    'topVendorsBySpendData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                vendor_code,
                vendor_name,
                count(distinct doc_entry) as bill_count,
                sum(total_amount_myr) as spend_myr
            from base_bills
            where (p_start_date is null or "bill_date"::date >= p_start_date)
              and (p_end_date   is null or "bill_date"::date <= p_end_date)
            group by vendor_code, vendor_name
            order by spend_myr desc
            limit 10
        ) x
    ),

    -- Gives the "unallocatedOutgoingPayments" KPI tile above a drill-down
    -- list -- mirrors unallocatedPaymentsData. Always "as of today" (not
    -- bounded by p_start_date/p_end_date).
    'unallocatedOutgoingPaymentsData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                vendor_code,
                vendor_name,
                payment_date,
                unallocated_amount
            from base_vendor_payments
            where unallocated_amount > 0.01
            order by unallocated_amount desc
            limit 10
        ) x
    ),

    -- P&L breakdown (Finance Expansion Phase 2, added 2026-07) -- period-
    -- bound, drawn from kpi_totals' GL figures above. Costs/expenses are
    -- returned as negative values so a bar chart reads left-to-right as a
    -- waterfall (Revenue down through Net Profit) without extra frontend math.
    'plBreakdownData', (
        select json_build_object(
            'Revenue', gl_period_revenue,
            'COGS', -gl_period_cogs,
            'Gross Profit', gl_period_revenue - gl_period_cogs,
            'Operating Expenses', -gl_period_opex,
            'Operating Profit', (gl_period_revenue - gl_period_cogs) - gl_period_opex,
            'Other Expenditure', -gl_period_other_expenditure,
            'Tax', -gl_period_tax,
            'Net Profit', ((gl_period_revenue - gl_period_cogs) - gl_period_opex) - gl_period_other_expenditure - gl_period_tax
        )
        from kpi_totals
    ),

    -- Balance sheet snapshot (Finance Expansion Phase 2, added 2026-07) --
    -- always "as of today", same convention as arAgingData/apAgingData above.
    'balanceSheetSnapshotData', (
        select json_build_object(
            'Current Assets', current_assets,
            'Fixed Assets', fixed_assets,
            'Current Liabilities', current_liabilities,
            'Total Equity', total_equity
        )
        from kpi_totals
    ),

    -- P&L trend (added 2026-07) -- monthly Revenue/COGS/OpEx/Net Profit,
    -- period-bound by p_start_date/p_end_date same as revenueTrendData above
    -- (all-time if no range selected). Answers "is profitability improving
    -- or declining", which plBreakdownData's single-period snapshot can't.
    'plTrendData', (
        select coalesce(json_agg(json_build_object(
            'period', to_char(month, 'YYYY-MM'),
            'revenue_myr', revenue,
            'cogs_myr', cogs,
            'opex_myr', opex,
            'net_profit_myr', revenue - cogs - opex - other_expenditure - tax
        ) order by month), '[]'::json)
        from (
            select
                date_trunc('month', posting_date::date) as month,
                coalesce(sum(credit_amount_myr - debit_amount_myr) filter (where drawer = 4), 0) as revenue,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 5), 0) as cogs,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 6), 0) as opex,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 7), 0) as other_expenditure,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 8), 0) as tax
            from base_gl_lines
            where (p_start_date is null or posting_date::date >= p_start_date)
              and (p_end_date   is null or posting_date::date <= p_end_date)
            group by 1
        ) x
    ),

    -- P&L YoY trend (added 2026-07) -- same 4 series as plTrendData above,
    -- bucketed by FISCAL YEAR (April-March, matching FiscalYearFilterBar's
    -- own definition in src/functions/fiscalYearPresets.js) instead of
    -- calendar month. Deliberately NOT bounded by p_start_date/p_end_date --
    -- always full history, same "always-on" convention as arAgingData/
    -- balanceSheetSnapshotData elsewhere in this RPC -- shows the whole
    -- multi-year growth/decline trajectory regardless of whatever period is
    -- currently selected. Cheap to add: base_gl_lines already reads
    -- unconditional full history for every call (see its own comment
    -- above), so this is one more aggregation pass over data already
    -- materialized for this request, not an extra join.
    'plYoyTrendData', (
        select coalesce(json_agg(json_build_object(
            'period', fiscal_year_start::text || '-' || (fiscal_year_start + 1)::text,
            'revenue_myr', revenue,
            'cogs_myr', cogs,
            'opex_myr', opex,
            'net_profit_myr', revenue - cogs - opex - other_expenditure - tax
        ) order by fiscal_year_start), '[]'::json)
        from (
            select
                (case when extract(month from posting_date) >= 4
                      then extract(year from posting_date)
                      else extract(year from posting_date) - 1
                 end)::int as fiscal_year_start,
                coalesce(sum(credit_amount_myr - debit_amount_myr) filter (where drawer = 4), 0) as revenue,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 5), 0) as cogs,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 6), 0) as opex,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 7), 0) as other_expenditure,
                coalesce(sum(debit_amount_myr - credit_amount_myr) filter (where drawer = 8), 0) as tax
            from base_gl_lines
            group by 1
        ) x
    ),

    -- Operating expense breakdown (added 2026-07) -- top 10 leaf expense
    -- accounts by amount, period-bound. Breaks down by individual leaf
    -- account rather than a Level-3 category grouping (unlike the interest
    -- lookup's "7200" node) -- only 7200 is confirmed as a Level-3 node under
    -- Expenses/drawer 6; other expense categories may or may not have their
    -- own, so grouping by leaf account is the always-correct choice here.
    'opexBreakdownData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                account_name,
                sum(debit_amount_myr - credit_amount_myr) as amount_myr
            from base_gl_lines
            where drawer = 6
              and (p_start_date is null or posting_date::date >= p_start_date)
              and (p_end_date   is null or posting_date::date <= p_end_date)
            group by account_code, account_name
            order by amount_myr desc
            limit 10
        ) x
    )

)
into result;

return result;

end;
$$;
