-- ############################################################################
-- sales_gross_profit_coverage.sql -- the data check that gates Gross Margin
-- on Sales Reports (plan: docs/sales/SALES-REPORTS-TABS-PLAN.md, final build
-- 2026-10-23, §4). Read-only. Paste into the Supabase SQL editor and run;
-- each block returns one small result.
--
-- THE RULE: Gross Margin (Invoicing tab) and Gross Profit by Rep (Team tab)
-- are released only if block 1's value_coverage_pct is 95 or more. Below
-- that, they are removed from the reports and the reason is recorded in the
-- plan doc -- a margin built on part of the invoices reads as the whole.
--
-- Definitions are the report's own (sales_invoice_facts, run
-- sales_metric_facts_views.sql first):
--   gross_profit_myr         SAP GrosProfit, null when > 5x the invoice
--                            (the outlier guard every dashboard applies)
--   invoiced_before_tax_myr  DocTotalSy - VatSum (both MYR at Hyrax)
-- ############################################################################


-- 1. Coverage over the last 12 complete months. THE DECIDING NUMBER is
--    value_coverage_pct: the share of Invoiced Revenue whose GP is known.
with w as (
    select (date_trunc('month', current_date) - interval '12 months')::date as from_d,
           (date_trunc('month', current_date) - interval '1 day')::date as to_d
)
select
    count(*)                                                        as invoices,
    count(*) filter (where gross_profit_myr is null)                as gp_unknown,
    round(100.0 * count(*) filter (where gross_profit_myr is not null)
          / nullif(count(*), 0), 1)                                 as count_coverage_pct,
    round(sum(invoiced_myr), 0)                                     as invoiced_myr,
    round(100.0 * sum(invoiced_myr) filter (where gross_profit_myr is not null)
          / nullif(sum(invoiced_myr), 0), 1)                        as value_coverage_pct,
    round(100.0 * sum(gross_profit_myr)
          / nullif(sum(invoiced_before_tax_myr) filter (where gross_profit_myr is not null), 0), 1)
                                                                    as gross_margin_pct
from public.sales_invoice_facts, w
where invoice_date between w.from_d and w.to_d;


-- 2. Why GP is unknown: the outlier guard, or SAP sent nothing.
with w as (
    select (date_trunc('month', current_date) - interval '12 months')::date as from_d,
           (date_trunc('month', current_date) - interval '1 day')::date as to_d
)
select
    count(*) filter (where i.gross_profit is null)                  as sap_gp_missing,
    count(*) filter (where i.gross_profit is not null
                       and f.gross_profit_myr is null)              as outlier_guarded,
    round(sum(f.invoiced_myr) filter (where f.gross_profit_myr is null), 0)
                                                                    as unknown_gp_invoiced_myr
from public.sales_invoice_facts f
join public.sap_invoices i on i.doc_entry = f.doc_entry, w
where f.invoice_date between w.from_d and w.to_d;


-- 3. Is GP on the before-tax basis? With known GP, margins should sit
--    between 0% and 100% for almost every invoice. Many outside that range
--    means GP and revenue are on different bases -- stop and investigate
--    before releasing the tile.
with w as (
    select (date_trunc('month', current_date) - interval '12 months')::date as from_d,
           (date_trunc('month', current_date) - interval '1 day')::date as to_d
),
m as (
    select gross_profit_myr / nullif(invoiced_before_tax_myr, 0) * 100 as margin
    from public.sales_invoice_facts, w
    where invoice_date between w.from_d and w.to_d
      and gross_profit_myr is not null
)
select
    count(*)                                    as invoices_with_gp,
    count(*) filter (where margin < 0)          as negative_margin,
    count(*) filter (where margin > 100)        as above_100_pct,
    round(percentile_cont(0.5) within group (order by margin)::numeric, 1)
                                                as median_margin_pct
from m;


-- 4. Coverage per month, to see whether a gap is recent or long-standing.
select
    to_char(date_trunc('month', invoice_date), 'YYYY-MM')           as month,
    count(*)                                                        as invoices,
    round(100.0 * sum(invoiced_myr) filter (where gross_profit_myr is not null)
          / nullif(sum(invoiced_myr), 0), 1)                        as value_coverage_pct
from public.sales_invoice_facts
where invoice_date >= (date_trunc('month', current_date) - interval '12 months')::date
  and invoice_date < date_trunc('month', current_date)::date
group by 1
order by 1;
