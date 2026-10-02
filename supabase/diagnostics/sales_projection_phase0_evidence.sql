-- ############################################################################
-- SALES PROJECTIONS -- PHASE 0 EVIDENCE
--
-- Read-only. No DDL, no writes, no transaction needed. Safe to run in the
-- Supabase SQL editor against production.
--
-- WHY THIS EXISTS
--
-- docs/sales/SALES-PROJECTIONS-ARCHITECTURE.md Phase 0 is a gate, not a
-- formality: it decides whether the whole feature gets built. Two questions
-- have to be answered with real numbers BEFORE any view, table or RPC exists,
-- because a negative answer to either means the correct action is to write the
-- finding down and stop.
--
--   Q1  How much genuinely complete monthly history is there, per measure?
--       The extractor's BOOTSTRAP_DATE = 2000-01-01 is a watermark FLOOR, not
--       evidence that SAP holds 25 years of rows. Seasonal methods need 2-3
--       full cycles (24-36 months) before a pattern is distinguishable from
--       noise. Block 1 answers this; block 1b shows the actual series.
--
--   Q2  Is the series driven by a handful of large documents?
--       THIS IS THE KILL CRITERION. For an industrial lubricants / transformer
--       oil business, monthly revenue is plausibly a few large tender
--       shipments rather than a broad book of steady orders. If the top 3
--       invoices routinely make up >40% of a month, then what looks like
--       "seasonality" is a contract cycle, every smoothing method in the plan
--       is the wrong family, and seasonal-naive will win the FVA gate. Block 2
--       answers this; block 2b summarises the verdict.
--
-- Blocks 3 and 4 are supporting context, not gates: year-level structure
-- (has the business changed level?) and a cheap seasonality preview.
--
-- HOW TO RUN
--
-- Run each numbered block on its own and export the grid to CSV into
-- diagnostics/results/ as phase0_1.csv, phase0_1b.csv, phase0_2.csv, etc.
-- (same convention as attendance_rls_scoping_check.sql's results/). Then paste
-- the block 1 and block 2b summaries into SALES-PROJECTIONS-ARCHITECTURE.md
-- Phase 0's exit criterion.
--
-- Each block repeats the `monthly` CTE rather than sharing one, so any block
-- can be pasted and run on its own without the others.
--
-- THE THREE MEASURE DEFINITIONS BELOW ARE LOAD-BEARING. They must stay
-- character-for-character identical to base_invoices / base_orders /
-- base_payment_apps in get_sales_reports_dashboard_rpc.sql, or Phase 0 will
-- measure a different series than the one the feature would eventually ship.
-- Note in particular: SAP dates are text (cast ::date); the RCT2 join is
-- payment_ref -> sap_payments.doc_entry, NOT receipt_number; inv_type = 13 is
-- the only enforcement of a polymorphic FK; and the cancelled-invoice guard
-- must left join RAW sap_invoices, never a pre-filtered relation.
-- ############################################################################


-- ============================================================================
-- BLOCK 1 -- Series depth and completeness, per measure
--
-- months_present < months_in_span means there are GAPS -- months with no
-- documents at all. A gap is not the same as a zero and will silently break a
-- lag(value, 12) baseline, because lag() counts ROWS, not calendar months.
-- If gaps exist, every downstream view needs a generate_series spine.
-- ============================================================================
with monthly as (
    select 'orders'::text                                    as measure,
           date_trunc('month', so.order_date::date)::date    as period_month,
           sum(so.total_amount_myr)                          as value,
           count(*)                                          as doc_count
    from sap_sales_orders so
    where so.is_cancelled = 'N'
    group by 1, 2

    union all

    select 'invoiced',
           date_trunc('month', oi.invoice_date::date)::date,
           sum(oi.total_amount_myr),
           count(*)
    from sap_invoices oi
    where oi.is_cancelled = 'N'
    group by 1, 2

    union all

    select 'collected',
           date_trunc('month', p.payment_date::date)::date,
           sum(pa.amount_applied_myr),
           count(*)
    from sap_payment_applications pa
    join sap_payments p   on pa.payment_ref = p.doc_entry
    left join sap_invoices i on pa.doc_entry = i.doc_entry and pa.inv_type = 13
    where p.is_cancelled = 'N'
      and (i.doc_entry is null or i.is_cancelled = 'N')
    group by 1, 2
)
select measure,
       min(period_month)                                       as first_month,
       max(period_month)                                       as last_month,
       count(*)                                                as months_present,
       ( (extract(year  from max(period_month)) - extract(year  from min(period_month))) * 12
       + (extract(month from max(period_month)) - extract(month from min(period_month))) )::int + 1
                                                               as months_in_span,
       count(*) filter (where period_month >= date_trunc('month', current_date) - interval '36 months')
                                                               as months_last_36,
       sum(doc_count)                                          as total_docs,
       round(sum(value))                                       as total_myr
from monthly
group by measure
order by measure;


-- ============================================================================
-- BLOCK 1b -- The actual series, last 60 months
--
-- Eyeball this. You are looking for: a visible repeating annual shape, an
-- obvious level shift, months that are zero or absurd, and whether the most
-- recent month is complete (it usually is not -- exclude the current month
-- from any training window).
-- ============================================================================
with monthly as (
    select 'orders'::text                                    as measure,
           date_trunc('month', so.order_date::date)::date    as period_month,
           sum(so.total_amount_myr)                          as value,
           count(*)                                          as doc_count
    from sap_sales_orders so
    where so.is_cancelled = 'N'
    group by 1, 2

    union all

    select 'invoiced',
           date_trunc('month', oi.invoice_date::date)::date,
           sum(oi.total_amount_myr),
           count(*)
    from sap_invoices oi
    where oi.is_cancelled = 'N'
    group by 1, 2

    union all

    select 'collected',
           date_trunc('month', p.payment_date::date)::date,
           sum(pa.amount_applied_myr),
           count(*)
    from sap_payment_applications pa
    join sap_payments p   on pa.payment_ref = p.doc_entry
    left join sap_invoices i on pa.doc_entry = i.doc_entry and pa.inv_type = 13
    where p.is_cancelled = 'N'
      and (i.doc_entry is null or i.is_cancelled = 'N')
    group by 1, 2
)
select period_month,
       round(sum(value) filter (where measure = 'orders'))    as orders_myr,
       round(sum(value) filter (where measure = 'invoiced'))  as invoiced_myr,
       round(sum(value) filter (where measure = 'collected')) as collected_myr,
       sum(doc_count)   filter (where measure = 'invoiced')   as invoice_count
from monthly
where period_month >= date_trunc('month', current_date) - interval '60 months'
group by period_month
order by period_month;


-- ============================================================================
-- BLOCK 2 -- CONCENTRATION TEST (the kill criterion), last 24 months
--
-- top3_share_pct is the number that decides this feature.
--
--   consistently < 25%   a broad book -- smoothing methods are appropriate
--   25-40%               mixed -- proceed, but expect wide intervals
--   routinely > 40%      tender-driven -- the "seasonality" is a contract
--                        cycle. STOP. Record the finding in the architecture
--                        doc's Phase 0 section and do not build Engine A.
--
-- Also watch invoice_count: a month carrying only a handful of documents is
-- structurally unforecastable regardless of what the share column says.
-- ============================================================================
with inv as (
    select date_trunc('month', oi.invoice_date::date)::date as period_month,
           oi.doc_entry,
           oi.total_amount_myr                              as value
    from sap_invoices oi
    where oi.is_cancelled = 'N'
      and oi.invoice_date::date >= date_trunc('month', current_date) - interval '24 months'
),
ranked as (
    select period_month,
           value,
           row_number() over (partition by period_month order by value desc nulls last) as rn,
           sum(value)  over (partition by period_month)                                 as month_total,
           count(*)    over (partition by period_month)                                 as month_docs
    from inv
)
select period_month,
       month_docs                                                             as invoice_count,
       round(month_total)                                                     as month_total_myr,
       round(100.0 * sum(value) filter (where rn <= 1)  / nullif(month_total, 0), 1) as top1_share_pct,
       round(100.0 * sum(value) filter (where rn <= 3)  / nullif(month_total, 0), 1) as top3_share_pct,
       round(100.0 * sum(value) filter (where rn <= 10) / nullif(month_total, 0), 1) as top10_share_pct
from ranked
group by period_month, month_total, month_docs
order by period_month;


-- ============================================================================
-- BLOCK 2b -- Concentration verdict, one row
--
-- This single row is what gets pasted into the architecture doc.
-- ============================================================================
with inv as (
    select date_trunc('month', oi.invoice_date::date)::date as period_month,
           oi.total_amount_myr                              as value
    from sap_invoices oi
    where oi.is_cancelled = 'N'
      and oi.invoice_date::date >= date_trunc('month', current_date) - interval '24 months'
),
ranked as (
    select period_month, value,
           row_number() over (partition by period_month order by value desc nulls last) as rn,
           sum(value)  over (partition by period_month)                                 as month_total
    from inv
),
per_month as (
    select period_month,
           100.0 * sum(value) filter (where rn <= 3) / nullif(month_total, 0) as top3_share_pct
    from ranked
    group by period_month, month_total
)
select count(*)                                              as months_examined,
       round(avg(top3_share_pct), 1)                         as avg_top3_share_pct,
       round(min(top3_share_pct), 1)                         as min_top3_share_pct,
       round(max(top3_share_pct), 1)                         as max_top3_share_pct,
       count(*) filter (where top3_share_pct > 40)           as months_over_40pct,
       round(100.0 * count(*) filter (where top3_share_pct > 40) / nullif(count(*), 0), 1)
                                                             as pct_of_months_over_40,
       case
           when avg(top3_share_pct) > 40 then 'STOP -- tender-driven, smoothing is the wrong family'
           when avg(top3_share_pct) > 25 then 'PROCEED WITH CAUTION -- expect wide intervals'
           else 'PROCEED -- broad book, smoothing is appropriate'
       end                                                   as verdict
from per_month;


-- ============================================================================
-- BLOCK 3 -- Year-level structure (supporting context, not a gate)
--
-- Looking for structural breaks: a year where the level steps up or down
-- sharply, or where months_with_data < 12. A break means the training window
-- should start AFTER it, not span it -- a trend fitted across a step change is
-- fitted to an event that will not repeat.
-- ============================================================================
select extract(year from oi.invoice_date::date)::int         as yr,
       count(distinct date_trunc('month', oi.invoice_date::date)) as months_with_data,
       count(*)                                              as invoice_count,
       round(sum(oi.total_amount_myr))                       as annual_myr,
       round(avg(oi.total_amount_myr))                       as avg_invoice_myr,
       round(sum(oi.total_amount_myr)
             / nullif(count(distinct date_trunc('month', oi.invoice_date::date)), 0))
                                                             as avg_month_myr
from sap_invoices oi
where oi.is_cancelled = 'N'
group by 1
order by 1;


-- ============================================================================
-- BLOCK 4 -- Seasonality preview (supporting context, not a gate)
--
-- A cheap look at whether a repeating calendar-month pattern exists at all,
-- before building the real decomposition. This is a RAW monthly average
-- indexed against the overall mean -- it does NOT detrend, so a growing
-- business will bias later calendar months upward. Treat it as a smell test
-- only; Engine A's ratio-to-moving-average in Phase 1 is the real measurement.
--
-- An index near 1.00 across all twelve months means no usable seasonality.
-- ============================================================================
with monthly as (
    select date_trunc('month', oi.invoice_date::date)::date as period_month,
           sum(oi.total_amount_myr)                         as value
    from sap_invoices oi
    where oi.is_cancelled = 'N'
      and oi.invoice_date::date >= date_trunc('month', current_date) - interval '60 months'
      and oi.invoice_date::date <  date_trunc('month', current_date)
    group by 1
)
select extract(month from period_month)::int                 as calendar_month,
       to_char(period_month, 'Mon')                          as month_name,
       count(*)                                              as years_observed,
       round(avg(value))                                     as avg_myr,
       round((avg(value) / nullif((select avg(value) from monthly), 0))::numeric, 3)
                                                             as raw_index
from monthly
group by 1, 2
order by 1;
