create or replace function get_finance_dashboard(
    p_customer_code   text default null,
    p_sales_rep_code  bigint default null,
    p_start_date      date default null,
    p_end_date        date default null,
    p_is_cancelled    boolean default null,
    p_status_code     text default null
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
    select oi.*
    from sap_invoices oi
    where oi.is_cancelled = v_is_cancelled_text
      and (p_customer_code  is null or oi.customer_code  = p_customer_code)
      and (p_sales_rep_code is null or oi.sales_rep_code = p_sales_rep_code)
      and (p_status_code    is null or oi.status_code    = p_status_code)
),

base_orders as (
    -- feeds salesRepRevenueData only (order_count/GP live on ORDR, not on invoices)
    select
        so.*,
        -- SAP's own GrosProfit occasionally contains impossible values (item
        -- cost/price master-data defect -- confirmed against the real SAP
        -- extract: legitimate gp/total_amount_myr ratios top out around 2.7x,
        -- defective rows run 900x-1000x+ in the same currency). Excluded from
        -- sums below; revenue_myr/order_count for the order are untouched --
        -- only its GP contribution is dropped.
        case
            when so.total_amount_myr <> 0
             and abs(so.gross_profit) > abs(so.total_amount_myr) * 5
            then null
            else so.gross_profit
        end as gross_profit_sanitized
    from sap_sales_orders so
    where so.is_cancelled = v_is_cancelled_text
      and (p_customer_code  is null or so.customer_code  = p_customer_code)
      and (p_sales_rep_code is null or so.sales_rep_code = p_sales_rep_code)
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
    left join sap_invoices i on pa.inv_entry = i.doc_entry and pa.inv_entry > 0
    where p.is_cancelled = v_is_cancelled_text
      and (p_customer_code  is null or p.customer_code = p_customer_code)
      and (p_sales_rep_code is null or i.sales_rep_code = p_sales_rep_code)
      -- NOTE: when p_sales_rep_code is set, on-account rows (inv_entry=0,
      -- i.sales_rep_code null) are correctly excluded -- unlinked cash
      -- can't be attributed to a rep.
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
         end) as prev_period_collected
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
            'dso', case when period_invoiced > 0
                        then round((outstanding_ar / period_invoiced) * v_days, 1)
                        else 0 end,
            'collectionRatePct', case when period_invoiced > 0
                        then round((period_collected / period_invoiced) * 100, 1)
                        else 0 end,
            'prevPeriodInvoicedRevenue', prev_period_invoiced,
            'prevTotalCollected',        prev_period_collected
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

    'salesRepRevenueData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                sp.sales_rep_code,
                sp.sales_rep_name,
                count(distinct bo.doc_entry) as order_count,
                coalesce(sum(bo.total_amount_myr), 0) as revenue_myr,
                coalesce(sum(bo.gross_profit_sanitized), 0) as gross_profit_myr,
                case when coalesce(sum(bo.total_amount_myr),0) > 0
                     then round((coalesce(sum(bo.gross_profit_sanitized),0) / sum(bo.total_amount_myr)) * 100, 1)
                     else 0 end as gp_pct
            from base_orders bo
            join sap_sales_persons sp on sp.sales_rep_code = bo.sales_rep_code
            where (p_start_date is null or bo."order_date"::date >= p_start_date)
              and (p_end_date   is null or bo."order_date"::date <= p_end_date)
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

    -- Contract placeholder for AP Aging (mirrors the existing AR Aging bucket
    -- shape). Blocked on OPOR/POR1 + OPCH/PCH1 + OVPM extraction -- returns
    -- null (not '[]') to distinguish "not available yet" from "available but
    -- empty". Fill this CTE in once that data lands; the RPC signature, this
    -- key, and the consuming chart never need to change.
    -- See hyrax-central-portal/docs/DEPARTMENT-DASHBOARD-BLUEPRINT.md §5.2, §7.
    'apAgingData', null

)
into result;

return result;

end;
$$;
