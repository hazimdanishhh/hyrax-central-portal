-- ############################################################################
-- v_sales_order_development -- chain-ladder LINK RATIOS
--
-- Phase A of docs/setup/SALES-PROJECTIONS-DEPLOYMENT-GUIDE.md.
-- Read-only view. Depends on sap_sales_orders + sap_invoice_lines.
--
-- REBUILT 2026-10-02. The first version measured incremental shares of
-- ORIGINAL order value -- "17% of an order invoices at lag 0, 28% at lag 1" --
-- and the model then applied f(a+h) / (1 - F(a)) to each open order's
-- remaining balance. Verification A6 showed that over-predicts badly: RM4.08M
-- from committed orders against roughly RM2.6M of order-sourced invoicing in
-- reality, about 60% too high.
--
-- THE BUG WAS SURVIVORSHIP, AND IT IS WORTH UNDERSTANDING
--
-- Those factors are estimated across ALL orders, the overwhelming majority of
-- which convert on schedule. But the orders still sitting open at age a are
-- precisely the ones that DID NOT. Applying an average-order conversion rate
-- to a population of known laggards over-states, systematically, and the error
-- compounds with age.
--
-- A4/A5 showed how bad the selection is here: 41.5% of outstanding value sits
-- in orders more than 24 months old, and the average age of an order still
-- carrying value is 68 months. The book is full of orders nobody ever closed
-- in SAP -- the same finding as Q6's "90.6% of the open book is overdue".
--
-- THE FIX: MEASURE CONDITIONALLY
--
-- This view now answers a different question:
--
--     Of value still OUTSTANDING at age a, what share converts at age a+1?
--
-- That is the standard actuarial link ratio. It is estimated on survivors and
-- applied to survivors, so the selection effect cancels instead of compounding.
-- It also self-corrects for the stale book: if orders older than two years
-- almost never convert, the link rate at those ages collapses toward zero on
-- its own, with no cut-off needed.
--
-- WHAT THE MODEL DOES WITH IT
--
-- For an order with remaining value R at age a, the chance it converts in
-- horizon month h is the chance it survives h-1 months unconverted and then
-- converts:
--
--     R x [ product over j of (1 - r(a+j)) ] x r(a+h-1)
--
-- survival_log below exists so the model can form that product as
-- exp(sum(log)) -- PostgreSQL has no product aggregate.
--
-- STILL VOLUME-WEIGHTED, STILL MATURE-COHORTS-ONLY
--
-- Both rules from the first version survive and matter as much as before:
-- sum(converted) / sum(outstanding) rather than averaging cohort percentages,
-- and a cohort only contributes to age a if it has actually lived through
-- a+1 months. An immature cohort is absence of evidence, not evidence of
-- non-conversion.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- ############################################################################

drop view if exists public.v_sales_order_development cascade;

create view public.v_sales_order_development
with (security_invoker = on) as

with bounds as (
    select (date_trunc('month', current_date) - interval '36 months')::date as cohort_start,
           (date_trunc('month', current_date) - interval '1 month')::date   as last_closed_month
),

cohorts as (
    select so.doc_entry,
           date_trunc('month', so.order_date::date)::date as cohort_month,
           so.total_amount_myr                            as ordered_myr
    from public.sap_sales_orders so
    cross join bounds b
    where so.is_cancelled = 'N'
      and so.order_date::date >= b.cohort_start
      and so.total_amount_myr > 0
),

-- Line-level attribution. Deliberately NOT
-- sap_sales_orders_with_fulfillment.total_invoiced_myr, which sums whole
-- invoice documents and over-states any order sharing an invoice (measured at
-- 0.6% in aggregate but 72% of orders -- see DASHBOARD-ROADMAP.md §4 Group C).
conversions as (
    select c.cohort_month,
           ( (extract(year  from i.invoice_date::date) - extract(year  from c.cohort_month)) * 12
           + (extract(month from i.invoice_date::date) - extract(month from c.cohort_month))
           )::int             as lag_months,
           sum(il.line_total) as converted_myr
    from cohorts c
    join public.sap_invoice_lines il
      on il.base_entry = c.doc_entry
     and il.base_type  = 17
    join public.sap_invoices i
      on i.doc_entry = il.doc_entry
     and i.is_cancelled = 'N'
    group by 1, 2
),

cohort_totals as (
    select cohort_month, sum(ordered_myr) as ordered_myr
    from cohorts
    group by 1
),

-- Dense grid: every cohort at every age 0..25. 25 so that age 24 has a
-- "next month" to look at.
grid as (
    select ct.cohort_month,
           ct.ordered_myr,
           l.lag_months,
           coalesce(cv.converted_myr, 0) as converted_myr
    from cohort_totals ct
    cross join (select generate_series(0, 25) as lag_months) l
    left join conversions cv
           on cv.cohort_month = ct.cohort_month
          and cv.lag_months   = l.lag_months
),

cum as (
    select *,
           sum(converted_myr) over (
               partition by cohort_month order by lag_months
               rows between unbounded preceding and current row
           ) as cum_converted
    from grid
),

-- At each age: what was still outstanding, and what converted the month after.
link as (
    select cohort_month,
           lag_months                                   as age_months,
           greatest(ordered_myr - cum_converted, 0)     as outstanding_at_age,
           lead(converted_myr) over (
               partition by cohort_month order by lag_months
           )                                            as converted_next
    from cum
),

mature as (
    select l.*
    from link l
    cross join bounds b
    -- The cohort must have lived through age+1 for that transition to be observed.
    where (l.cohort_month + ((l.age_months + 1) || ' months')::interval)::date
          <= b.last_closed_month
      and l.converted_next is not null
      and l.age_months <= 24
),

rates as (
    select age_months,
           count(*)                   as cohorts_used,
           sum(outstanding_at_age)    as outstanding_myr,
           sum(converted_next)        as converted_next_myr,
           -- The link ratio: share of outstanding value settling next month.
           -- Clamped below 1 so the survival product below can never take
           -- log(0); a rate of exactly 1 would also claim an age at which
           -- every remaining ringgit converts without exception, which no
           -- finite sample justifies.
           least(
               greatest(sum(converted_next) / nullif(sum(outstanding_at_age), 0), 0),
               0.95
           )                          as link_rate
    from mature
    group by age_months
)

select age_months,
       cohorts_used,
       outstanding_myr,
       converted_next_myr,
       link_rate,
       -- ln(1 - r). The model sums these over an age range and exponentiates
       -- to get survival, because PostgreSQL has no product aggregate.
       ln(greatest(1 - link_rate, 0.0001))                           as survival_log,
       -- Reference only: cumulative share of ORIGINAL value developed by this
       -- age, reconstructed from the link ratios. Useful for sanity-checking
       -- against A2's old cum_at_12 / cum_at_24, not used by the model.
       1 - exp(sum(ln(greatest(1 - link_rate, 0.0001)))
               over (order by age_months rows between unbounded preceding and current row))
                                                                     as implied_cumulative
from rates
order by age_months;


comment on view public.v_sales_order_development is
    'Chain-ladder LINK RATIOS: share of still-outstanding order value that '
    'converts to invoice in the following month, by age. Estimated on '
    'survivors and applied to survivors, which cancels the survivorship bias '
    'that made the earlier share-of-original formulation over-predict by ~60% '
    '(verification A6). survival_log supports the model''s survival product.';


-- Verification queries live in
-- supabase/diagnostics/sales_projection_phaseA_verification.sql
-- Run them one at a time, after this file has succeeded.
