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
as
$$
declare
    result json;
    v_prev_start_date date;
    v_prev_end_date date;
    v_is_cancelled_text text;
    v_days numeric;
begin

-- 1. Calculate the Previous Period for Deltas (mirrors get_sales_leads_dashboard)
if p_start_date is not null and p_end_date is not null then
    v_prev_end_date := p_start_date - 1;
    v_prev_start_date := v_prev_end_date - (p_end_date - p_start_date);
    v_days := (p_end_date - p_start_date) + 1;
else
    v_days := 365; -- annualized default for DSO when no range is selected
end if;

-- Finance must never silently blend cancelled/voided SAP docs into revenue/AR.
-- null/false -> active docs only ('N'). true -> cancelled-only audit view ('Y').
v_is_cancelled_text := case when p_is_cancelled is true then 'Y' else 'N' end;

with base_invoices as (
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

kpi_totals as (
    select
        (select coalesce(sum(total_amount_myr),0) from base_invoices
          where (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date   is null or "invoice_date"::date <= p_end_date)
        ) as period_invoiced,

        (select count(*) from base_invoices
          where (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date   is null or "invoice_date"::date <= p_end_date)
        ) as period_invoice_count,

        (select coalesce(sum(amount_applied_myr),0) from base_payment_apps
          where (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date   is null or payment_date::date <= p_end_date)
        ) as period_collected,

        -- NOTE: outstanding_ar is sourced straight from sap_invoices.paid_to_date
        -- (SAP's own native per-invoice running total -- OINV.PaidToDate), with
        -- no RCT2/payment-applications join involved at all. period_collected
        -- above, by contrast, comes from base_payment_apps (RCT2), which can
        -- only attribute inv_type=13 rows. These two numbers measure "money
        -- paid" via two different SAP sources, so period_invoiced -
        -- period_collected will NOT generally equal outstanding_ar, even with
        -- no date filter applied -- that gap reflects real cash that settled
        -- invoices through a document type the RCT2 join can't see (on-account
        -- cash, credit memos, etc.), not an error in either figure. See
        -- hyrax-central-portal/docs/RPC-REFERENCE.md's Finance section.
        (select coalesce(sum(total_amount_myr - paid_to_date),0) from base_invoices
          where status_code = 'O'
        ) as outstanding_ar,

        (select count(*) from base_invoices
          where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ) as overdue_count,

        (select coalesce(sum(total_amount_myr - paid_to_date),0) from base_invoices
          where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ) as overdue_value,

        (select coalesce(sum(unallocated_amount),0) from base_payments
          where (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date   is null or payment_date::date <= p_end_date)
        ) as unallocated_payments,

        (select case when p_start_date is null then null else
            (select coalesce(sum(total_amount_myr),0) from base_invoices
              where "invoice_date"::date between v_prev_start_date and v_prev_end_date)
         end) as prev_period_invoiced,

        (select case when p_start_date is null then null else
            (select coalesce(sum(amount_applied_myr),0) from base_payment_apps
              where payment_date::date between v_prev_start_date and v_prev_end_date)
         end) as prev_period_collected,

        -- Gross Profit -- SAP's own pre-computed GrosProfit line-item field
        -- (via gross_profit_sanitized's outlier guard above), summed the
        -- same way/scope as period_invoiced. Maps to the target KPI
        -- framework's "Gross Profit Margin" (see
        -- hyrax-data-platform/docs/sap-data-architecture-plans/
        -- 02-department-kpi-frameworks.md) -- SAP already computes GrosProfit
        -- per line, so no separate COGS derivation is needed here.
        (select coalesce(sum(gross_profit_sanitized),0) from base_invoices
          where (p_start_date is null or "invoice_date"::date >= p_start_date)
            and (p_end_date   is null or "invoice_date"::date <= p_end_date)
        ) as period_gross_profit,

        (select case when p_start_date is null then null else
            (select coalesce(sum(gross_profit_sanitized),0) from base_invoices
              where "invoice_date"::date between v_prev_start_date and v_prev_end_date)
         end) as prev_period_gross_profit,

        -- ─── Accounts Payable chain totals (Finance Expansion Phase 1) ──────
        -- Mirrors period_invoiced/period_collected/outstanding_ar/overdue_*/
        -- unallocated_payments above, field-for-field, on the payables side.

        (select coalesce(sum(total_amount_myr),0) from base_bills
          where (p_start_date is null or "bill_date"::date >= p_start_date)
            and (p_end_date   is null or "bill_date"::date <= p_end_date)
        ) as period_billed,

        (select count(*) from base_bills
          where (p_start_date is null or "bill_date"::date >= p_start_date)
            and (p_end_date   is null or "bill_date"::date <= p_end_date)
        ) as period_bill_count,

        (select coalesce(sum(amount_applied_myr),0) from base_vendor_payment_apps
          where (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date   is null or payment_date::date <= p_end_date)
        ) as period_paid,

        -- Same sourcing caveat as outstanding_ar: straight from
        -- sap_vendor_bills.paid_to_date, no VPM2 join involved -- won't
        -- generally reconcile exactly against period_billed - period_paid,
        -- for the same reason outstandingAR doesn't reconcile against
        -- periodInvoicedRevenue - totalCollected (see that comment above).
        (select coalesce(sum(total_amount_myr - paid_to_date),0) from base_bills
          where status_code = 'O'
        ) as outstanding_ap,

        (select count(*) from base_bills
          where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ) as overdue_bill_count,

        (select coalesce(sum(total_amount_myr - paid_to_date),0) from base_bills
          where status_code = 'O' and "due_date"::date < current_date
            and (total_amount_myr - paid_to_date) > 0.01
        ) as overdue_bill_value,

        (select coalesce(sum(unallocated_amount),0) from base_vendor_payments
          where (p_start_date is null or payment_date::date >= p_start_date)
            and (p_end_date   is null or payment_date::date <= p_end_date)
        ) as unallocated_outgoing_payments,

        (select case when p_start_date is null then null else
            (select coalesce(sum(total_amount_myr),0) from base_bills
              where "bill_date"::date between v_prev_start_date and v_prev_end_date)
         end) as prev_period_billed,

        (select case when p_start_date is null then null else
            (select coalesce(sum(amount_applied_myr),0) from base_vendor_payment_apps
              where payment_date::date between v_prev_start_date and v_prev_end_date)
         end) as prev_period_paid
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
            -- First (partial) Working Capital signal ahead of full GL
            -- (Phase 2) -- net AR/AP position, not a complete working-capital
            -- figure (that needs all current assets/liabilities from the GL).
            'netArApPosition', outstanding_ar - outstanding_ap,
            'prevPeriodBilled', prev_period_billed,
            'prevTotalPaid',    prev_period_paid
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
    )

)
into result;

return result;

end;
$$;
