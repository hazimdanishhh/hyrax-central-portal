-- ############################################################################
-- v_sales_order_development_pit -- link ratios AS THEY STOOD, month by month
--
-- Stage 1 of the forecast remediation. Read-only view.
--
-- ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
--
-- v_sales_order_development computes one set of conversion rates, "as of
-- today". That is correct for forecasting forward. It is WRONG for testing the
-- model against the past, and the old chain-ladder backtest used it anyway:
-- scoring an origin in March 2025 applied rates partly derived from 2026.
--
-- The model was being shown the answer. The file disclosed this as testing
-- "structure, not parameter estimation", which is a real distinction, but it
-- was never surfaced outside the code and it quietly flatters every accuracy
-- figure downstream.
--
-- This view computes the rates for EVERY as-of month, so a backtest at origin
-- o can use exactly what was knowable at o and nothing later.
--
-- ── THE ARITHMETIC IS UNCHANGED ─────────────────────────────────────────────
--
-- Same chain as the original: cohorts -> conversions -> grid -> cum -> link ->
-- mature -> rates. Same 0.95 clamp, same ln(1-r) survival term. The ONLY
-- change is that `bounds` stops being a pair of scalars computed from
-- current_date and becomes a dimension joined in at `mature`.
--
-- ── WHY FILTERING AT `mature` IS SUFFICIENT ─────────────────────────────────
--
-- `conversions` still holds every invoice, including ones after a given
-- as-of month. That is not a leak, and the reason is worth stating because it
-- looks like one.
--
-- A row survives `mature` only when cohort_month + (age + 1) <= as_of - 1.
-- Everything that row depends on falls before that bound:
--
--     converted_next   lands in month cohort + age + 1  -- bounded above
--     cum_converted    sums lags 0..age, so at latest cohort + age  -- earlier
--
-- So no quantity used to compute a rate at a given as-of month comes from
-- after it. Filtering later rows out of `conversions` as well would change
-- nothing and cost a scan.
--
-- ── ONE SOURCE OF TRUTH ─────────────────────────────────────────────────────
--
-- v_sales_order_development is REDEFINED as a thin filter over this view at the
-- current month, rather than keeping its own copy of the arithmetic. Two
-- implementations of the same calculation is precisely the shape of bug that
-- produced the UNION ALL positional mismatch in Phase C -- they agree until one
-- is edited.
--
-- ── A PARAMETER THAT IS STILL UNEXAMINED ────────────────────────────────────
--
-- The 36-month cohort window is a number set without testing. It is carried
-- forward here unchanged so this view is a like-for-like replacement, but it
-- has never been swept the way the calibration window and the order-book
-- weight were. Sweeping it belongs with the walk-forward work, and until then
-- it is an assumption, not a finding.
--
-- Idempotent. Hand-paste into the Supabase SQL editor.
-- Run BEFORE sales_order_development_view.sql, which now reads this.
-- ############################################################################

create or replace view public.v_sales_order_development_pit
with (security_invoker = on) as

with params as (
    select 36 as cohort_window_months,  -- see the note above: untested
           24 as max_age_months,
           25 as grid_ages,             -- so age 24 has a "next month"
           0.95 as max_link_rate
),

-- Every month the rates can meaningfully be computed for: from the first month
-- with a full cohort window behind it, through the current month. Derived from
-- the data rather than hardcoded -- a literal date here would be exactly the
-- kind of silent bound this whole exercise exists to remove.
as_of_bounds as (
    select (min(date_trunc('month', so.order_date::date))
            + (p.cohort_window_months || ' months')::interval)::date as first_as_of,
           date_trunc('month', current_date)::date                   as last_as_of
    from public.sap_sales_orders so
    cross join params p
    where so.is_cancelled = 'N'
      and so.total_amount_myr > 0
    group by p.cohort_window_months
),

as_of_months as (
    select gs::date as as_of_month
    from as_of_bounds b
    cross join lateral generate_series(b.first_as_of, b.last_as_of, interval '1 month') gs
),

-- ALL cohorts, unbounded. The per-as-of window is applied at `mature`, because
-- a cohort that is outside one as-of month's window is inside another's.
cohorts as (
    select so.doc_entry,
           date_trunc('month', so.order_date::date)::date as cohort_month,
           so.total_amount_myr                            as ordered_myr
    from public.sap_sales_orders so
    where so.is_cancelled = 'N'
      and so.total_amount_myr > 0
),

-- Line-level attribution. Deliberately NOT
-- sap_sales_orders_with_fulfillment.total_invoiced_myr, which sums whole
-- invoice documents and over-states any order sharing an invoice (72% of
-- orders -- see DASHBOARD-ROADMAP.md §4 Group C).
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

grid as (
    select ct.cohort_month,
           ct.ordered_myr,
           l.lag_months,
           coalesce(cv.converted_myr, 0) as converted_myr
    from cohort_totals ct
    cross join params p
    cross join lateral (select generate_series(0, p.grid_ages) as lag_months) l
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

link as (
    select cohort_month,
           lag_months                                   as age_months,
           greatest(ordered_myr - cum_converted, 0)     as outstanding_at_age,
           lead(converted_myr) over (
               partition by cohort_month order by lag_months
           )                                            as converted_next
    from cum
),

-- The whole point of this view. Each as-of month sees only the transitions it
-- could have observed, from cohorts inside its own window.
mature as (
    select a.as_of_month,
           l.age_months,
           l.outstanding_at_age,
           l.converted_next
    from link l
    cross join as_of_months a
    cross join params p
    where l.converted_next is not null
      and l.age_months <= p.max_age_months
      -- observed: the cohort lived through age+1 before this as-of month
      and (l.cohort_month + ((l.age_months + 1) || ' months')::interval)::date
            <= (a.as_of_month - interval '1 month')::date
      -- and sits inside this as-of month's cohort window
      and l.cohort_month
            >= (a.as_of_month - (p.cohort_window_months || ' months')::interval)::date
),

rates as (
    select m.as_of_month,
           m.age_months,
           count(*)                      as cohorts_used,
           sum(m.outstanding_at_age)     as outstanding_myr,
           sum(m.converted_next)         as converted_next_myr,
           -- Share of outstanding value settling next month. Clamped below 1 so
           -- the survival product can never take log(0); a rate of exactly 1
           -- would also claim an age at which every remaining ringgit converts
           -- without exception, which no finite sample justifies.
           least(
               greatest(sum(m.converted_next) / nullif(sum(m.outstanding_at_age), 0), 0),
               p.max_link_rate
           )                             as link_rate
    from mature m
    cross join params p
    group by m.as_of_month, m.age_months, p.max_link_rate
)

select as_of_month,
       age_months,
       cohorts_used,
       outstanding_myr,
       converted_next_myr,
       link_rate,
       -- ln(1 - r). The model sums these over an age range and exponentiates
       -- to get survival, because PostgreSQL has no product aggregate.
       ln(greatest(1 - link_rate, 0.0001))                           as survival_log,
       -- Reference only: cumulative share of ORIGINAL value developed by this
       -- age, reconstructed from the link ratios. PARTITIONED BY as_of_month --
       -- without that it would run the cumulative across month boundaries and
       -- silently return nonsense.
       1 - exp(sum(ln(greatest(1 - link_rate, 0.0001)))
               over (partition by as_of_month
                     order by age_months
                     rows between unbounded preceding and current row))
                                                                     as implied_cumulative
from rates
order by as_of_month, age_months;


comment on view public.v_sales_order_development_pit is
    'Chain-ladder link ratios computed for EVERY as-of month, so a backtest at '
    'origin o uses only what was knowable at o. Replaces the previous '
    'arrangement where the backtest scored past months against rates derived '
    'partly from after them. Same arithmetic as v_sales_order_development, '
    'which is now a filter over this view at the current month. The 36-month '
    'cohort window is carried forward unchanged and remains untested.';


-- ── VERIFY ──────────────────────────────────────────────────────────────────
--
-- The rates MUST move between as-of months. A flat column means the dimension
-- is not binding and the original problem is still there:
--
--     select as_of_month, round(link_rate::numeric, 4) as rate_at_age_0,
--            cohorts_used
--     from public.v_sales_order_development_pit
--     where age_months = 0
--     order by as_of_month;
--
-- And the current month must reproduce the old view exactly:
--
--     select age_months, round(link_rate::numeric, 6)
--     from public.v_sales_order_development_pit
--     where as_of_month = date_trunc('month', current_date)::date
--     order by age_months;
-- ############################################################################
