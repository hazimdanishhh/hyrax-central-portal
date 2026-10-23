-- ############################################################################
-- sales_metric_functions.sql -- LAYER 2 of the Sales Reports metric layer.
-- See docs/sales/SALES-REPORTS-TABS-PLAN.md §4.
--
-- Every rule a report needs, written once:
--   fiscal_year_start()      April-March fiscal year
--   report_last_year()       the same period one year back
--   months_spanned()         months covered by a date range (part-months by days)
--   report_period()          the selected period, its comparison window and
--                            its trend window (not sales-specific: reusable
--                            by Finance / HR / Operations reports)
--   prorate_months()         a monthly plan amount spread over any date range
--   can_view_sales_reports() who may see Sales Reports (SAL / MGM / superadmin)
--   sales_report_scope()     access guard + salesperson resolution
--   sales_totals()           the headline totals for one window
--   sales_monthly_series()   the same measures per month (every trend chart)
--   sales_rep_totals()       the same measures per sales rep (bridge, scorecard)
--   sales_owner_totals()     the CRM measures per lead owner (scorecard)
--   sales_pipeline_totals()  generated / won / lost / win rate / open pipeline
--   sales_pipeline_coverage() Active Pipeline vs the target left this FY
--   sales_run_rate()         the last 3 complete months (recent pace)
--   sales_order_book_totals() open backlog, overdue, delivered-not-invoiced
--   ar_dso()                 Days Sales Outstanding (Finance's formula)
--   sales_receivable_totals() outstanding, overdue, aging, DSO
--   sales_gross_margin()     gross profit / margin and how much of it is known
--   sales_fy_progress()      fiscal year to date, FY budget, months left
--   sales_report_meta()      the meta block every report RPC returns
--
-- PERIOD FIGURES vs OPEN BALANCES (2026-10-23, DASHBOARD-CONVENTIONS §8 R3).
-- A period figure (orders, invoices, payments, won deals in a window) takes
-- the window. An open balance (Active Pipeline, Pending SAP Order Entry, Open
-- Backlog, Outstanding, Overdue) is a snapshot of TODAY and takes no window
-- at all: on a report it is never narrowed to "raised in the period" (that
-- is a different fact), and it has no previous-period figure (no history of
-- balances is kept, and approximating one is Conventions §4b's named
-- anti-pattern).
--
-- The three sales_* aggregations read ONLY the Layer 1 fact views, and the
-- report RPCs call them instead of writing their own SQL. That is what makes
-- these guarantees structural rather than a convention:
--   * the same measure on two tabs is the same function call;
--   * a previous-period figure is the SAME call as the current one with the
--     comparison window's dates, so it cannot be defined differently;
--   * sum(monthly series) = sum(rep rows) = totals, for the same window.
-- tests/sql/sales_metrics.test.js checks all three.
--
-- Salesperson scope, used by every sales_* function:
--   p_rep   bigint  SAP sales rep code (orders, invoices, collections, budget)
--   p_owner uuid    CRM lead owner, an employees.id (won deals, target)
--   null = everyone. An owner with no SAP mapping gets p_rep = -1, which
--   matches nothing (fail closed) -- see sales_report_scope().
--
-- All SQL-language functions are single-SELECT, STABLE/IMMUTABLE and
-- SECURITY INVOKER, so Postgres can inline them into the calling query.
--
-- Run after sales_metric_facts_views.sql. Re-runnable.
-- ############################################################################


-- ─── fiscal_year_start ──────────────────────────────────────────────────────
-- 1 April of the fiscal year containing d (Hyrax runs April-March; same rule
-- as src/functions/periodRange.js and fiscalYearPresets.js).
create or replace function public.fiscal_year_start(d date)
returns date
language sql
immutable
as $$
    select make_date(
        extract(year from d)::int - case when extract(month from d) >= 4 then 0 else 1 end,
        4, 1)
$$;


-- ─── report_period ──────────────────────────────────────────────────────────
-- The period rules shipped on 2026-10-22 (docs/portal/DASHBOARD-CONVENTIONS.md
-- §4b), moved out of get_sales_reports_dashboard so every report shares them:
--
--   start_date/end_date  the selected period; no dates = the full current month
--   prev_start/prev_end  what deltas compare against:
--                        * whole months -> the same number of whole months
--                          before (Oct vs Sep, FY vs previous FY);
--                          otherwise the same number of days before;
--                        * while today is inside the period, cut to the same
--                          number of days (1-22 Oct vs 1-22 Sep), capped at
--                          that period's own end
--   trend_start/end      monthly charts: the period itself if a year or
--                        longer, else the fiscal year(s) containing it
--   has_period           both dates were given (reported in meta; no Sales
--                        report figure depends on it since 2026-10-23 --
--                        open balances are always today)
--   comparison_is_partial  the like-for-like cut above applies
--
-- Mirrors src/functions/periodRange.js (the period picker) by construction.
create or replace function public.report_period(p_start date, p_end date)
returns table (
    start_date date,
    end_date date,
    prev_start date,
    prev_end date,
    trend_start date,
    trend_end date,
    has_period boolean,
    comparison_is_partial boolean
)
language sql
stable
as $$
    with eff as (
        select
            coalesce(p_start, date_trunc('month', current_date)::date) as s,
            coalesce(p_end, (date_trunc('month', current_date)
                             + interval '1 month' - interval '1 day')::date) as e
    ),
    shape as (
        select
            s, e,
            extract(day from s) = 1 and extract(day from e + 1) = 1 as whole_months,
            ((extract(year from e) * 12 + extract(month from e))
              - (extract(year from s) * 12 + extract(month from s)) + 1)::int as months,
            current_date between s and e as in_progress
        from eff
    ),
    prev as (
        select
            s, e, in_progress,
            case
                when whole_months then (s - make_interval(months => months))::date
                else (s - 1) - (e - s)
            end as ps,
            s - 1 as pe_full
        from shape
    )
    select
        s,
        e,
        ps,
        case
            when in_progress then least(pe_full, ps + (current_date - s))
            else pe_full
        end,
        case
            when e >= (s + interval '1 year' - interval '1 day')::date then s
            else public.fiscal_year_start(s)
        end,
        case
            when e >= (s + interval '1 year' - interval '1 day')::date then e
            else (public.fiscal_year_start(e) + interval '1 year' - interval '1 day')::date
        end,
        p_start is not null and p_end is not null,
        in_progress
    from prev
$$;


-- ─── report_last_year ───────────────────────────────────────────────────────
-- The same period one year back, for "Same Period Last Year" (2026-10-23).
-- Built on report_period so it inherits its rules:
--   * whole months stay whole months: Feb 2029 compares with ALL of Feb 2028
--     (29 days), not 1-28 Feb;
--   * while the period is still running it is cut to the same days, like
--     the comparison window: 1-23 Oct 2026 compares with 1-23 Oct 2025.
-- A separate function (not extra report_period columns) so report_period's
-- signature never changes.
create or replace function public.report_last_year(p_start date, p_end date)
returns table (ly_start date, ly_end date)
language sql
stable
as $$
    with per as (
        select * from public.report_period(p_start, p_end)
    ),
    shifted as (
        select
            (start_date - interval '1 year')::date as s,
            case
                when extract(day from end_date + 1) = 1
                then (date_trunc('month', end_date - interval '1 year')
                      + interval '1 month' - interval '1 day')::date
                else (end_date - interval '1 year')::date
            end as e_full,
            comparison_is_partial
        from per
    )
    select
        s,
        case
            when comparison_is_partial then least(e_full, (current_date - interval '1 year')::date)
            else e_full
        end
    from shifted
$$;


-- ─── prorate_months ─────────────────────────────────────────────────────────
-- A monthly plan amount (budget or target) counted for the days of that month
-- falling inside [p_from, p_to]. The one proration formula (previously
-- written out separately for budget and target, for current and previous
-- periods, in each RPC).
create or replace function public.prorate_months(
    p_amount numeric,
    p_month date,
    p_from date,
    p_to date
)
returns numeric
language sql
immutable
as $$
    select p_amount * greatest(0,
        (least(p_to, (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date)
         - greatest(p_from, date_trunc('month', p_month)::date)) + 1
    ) / extract(day from (date_trunc('month', p_month) + interval '1 month' - interval '1 day'))
$$;


-- ─── months_spanned ─────────────────────────────────────────────────────────
-- How many months [p_from, p_to] covers, counting part-months by their days
-- (1-23 Oct = 23/31 of a month). It is prorate_months over an amount of 1,
-- so it can never disagree with how budgets and targets are prorated.
-- 0 when p_to is before p_from.
create or replace function public.months_spanned(p_from date, p_to date)
returns numeric
language sql
immutable
as $$
    select coalesce(sum(public.prorate_months(1, m::date, p_from, p_to)), 0)
    from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') m
    where p_to >= p_from
$$;


-- ─── can_view_sales_reports ─────────────────────────────────────────────────
-- Who may see Sales Reports: superadmin, or anyone in SAL / MGM. The one copy
-- of that rule: sales_report_scope() raises on it, and the RLS policies of
-- sales_report_briefs (the AI Meeting Brief) use it, so a brief can never be
-- read by someone who couldn't open the report it summarises.
create or replace function public.can_view_sales_reports()
returns boolean
language sql
stable
security invoker
as $$
    select coalesce((
        select r.name = 'superadmin' or d.sub in ('SAL', 'MGM')
        from public.profiles p
        join public.roles r on r.id = p.role_id
        join public.departments d on d.id = p.department_id
        where p.id = auth.uid()
    ), false)
$$;


-- ─── sales_report_scope ─────────────────────────────────────────────────────
-- Access guard + salesperson resolution, called first by every Sales report
-- RPC (previously copy-pasted into each one).
--
--   * caller must pass can_view_sales_reports() -- 'Access denied' otherwise;
--     several tables behind these reports have no RLS, so this is the gate
--   * a staff-role caller is forced to their own data, whatever owner was asked
--   * owner -> SAP rep code via employee_sales_rep_mapping; an owner with no
--     mapping gets rep -1 (matches nothing) and mapping_missing = true, so the
--     page can explain the zeros instead of silently showing everyone (the
--     2026-08 fail-open fix)
--
-- plpgsql, not sql: it has to RAISE. Runs once per request.
create or replace function public.sales_report_scope(p_owner_id uuid)
returns table (owner_id uuid, sales_rep_code bigint, mapping_missing boolean)
language plpgsql
stable
security invoker
as $$
declare
    v_role text;
    v_employee_id uuid;
    v_owner uuid := p_owner_id;
    v_rep bigint;
begin
    select r.name, e.id
      into v_role, v_employee_id
    from public.profiles p
    join public.roles r on r.id = p.role_id
    left join public.employees e on e.profile_id = p.id
    where p.id = auth.uid();

    if v_role is null or not public.can_view_sales_reports() then
        raise exception 'Access denied';
    end if;

    if v_role = 'staff' then
        v_owner := v_employee_id;
    end if;

    if v_owner is not null then
        select m.sales_rep_code into v_rep
        from public.employee_sales_rep_mapping m
        where m.employee_id = v_owner;
    end if;

    return query select
        v_owner,
        case when v_owner is not null and v_rep is null then -1::bigint else v_rep end,
        v_owner is not null and v_rep is null;
end;
$$;


-- ─── sales_totals ───────────────────────────────────────────────────────────
-- Every headline measure for one window. Report RPCs call it twice -- once
-- for report_period's (start, end), once for (prev_start, prev_end) -- so a
-- comparison figure is computed by exactly the same code as the figure it is
-- compared with.
create or replace function public.sales_totals(
    p_rep bigint,
    p_owner uuid,
    p_from date,
    p_to date
)
returns table (
    invoiced numeric,
    invoice_count bigint,
    booked numeric,
    order_count bigint,
    ordering_customers bigint,
    collected numeric,
    payment_count bigint,
    paying_customers bigint,
    won numeric,
    won_count bigint,
    budget numeric,
    target numeric
)
language sql
stable
security invoker
as $$
    select
        i.invoiced, i.invoice_count,
        o.booked, o.order_count, o.ordering_customers,
        c.collected, c.payment_count, c.paying_customers,
        w.won, w.won_count,
        b.budget,
        t.target
    from (
        select coalesce(sum(invoiced_myr), 0) as invoiced, count(*) as invoice_count
        from public.sales_invoice_facts
        where invoice_date between p_from and p_to
          and (p_rep is null or sales_rep_code = p_rep)
    ) i
    cross join (
        select coalesce(sum(booked_myr), 0) as booked,
               count(*) as order_count,
               count(distinct customer_code) as ordering_customers
        from public.sales_order_facts
        where order_date between p_from and p_to
          and (p_rep is null or sales_rep_code = p_rep)
    ) o
    cross join (
        select coalesce(sum(applied_myr), 0) as collected,
               count(distinct payment_doc_entry) as payment_count,
               count(distinct customer_code) as paying_customers
        from public.sales_collection_facts
        where payment_date between p_from and p_to
          and (p_rep is null or sales_rep_code = p_rep)
    ) c
    cross join (
        select coalesce(sum(won_myr), 0) as won, count(*) as won_count
        from public.sales_won_lead_facts
        where closed_on between p_from and p_to
          and (p_owner is null or owner_employee_id = p_owner)
    ) w
    cross join (
        -- null, not 0, when no budget row overlaps the window: "no budget
        -- set" must read as "—", never as a budget of RM0 (audit D3).
        select sum(public.prorate_months(budget_revenue, budget_month, p_from, p_to)) as budget
        from public.sales_budgets
        where date_trunc('month', budget_month) <= p_to
          and date_trunc('month', budget_month) + interval '1 month' > p_from
          and (p_rep is null or sales_rep_code = p_rep)
    ) b
    cross join (
        select sum(public.prorate_months(target_revenue, target_month, p_from, p_to)) as target
        from public.sales_targets
        where date_trunc('month', target_month) <= p_to
          and date_trunc('month', target_month) + interval '1 month' > p_from
          and (p_owner is null or lead_owner_id = p_owner)
    ) t
$$;


-- ─── sales_monthly_series ───────────────────────────────────────────────────
-- The same measures per calendar month of [p_from, p_to] (normally
-- report_period's trend window), one row per month whether or not anything
-- happened. Every monthly chart on every tab reads this.
--
--   ACTUALS (invoiced, collected, booked, won): 0 for a past month with no
--   activity, null for a month after the current one -- so a line stops at
--   today instead of dropping to zero.
--   PLANS (budget, target): null where no plan row exists ("not set" is a
--   gap, never a fake zero); prorated by the same prorate_months() as
--   sales_totals, so the months add up to the totals for the same window.
--   is_partial  the current month (in progress)
--   in_period   inside [p_sel_from, p_sel_to], the selected period, for
--               highlighting it inside a wider trend window
create or replace function public.sales_monthly_series(
    p_rep bigint,
    p_owner uuid,
    p_from date,
    p_to date,
    p_sel_from date,
    p_sel_to date
)
returns table (
    month_start date,
    is_partial boolean,
    in_period boolean,
    invoiced numeric,
    collected numeric,
    booked numeric,
    won numeric,
    budget numeric,
    target numeric
)
language sql
stable
security invoker
as $$
    with months as (
        select
            m::date as month_start,
            m::date > date_trunc('month', current_date)::date as is_future
        from generate_series(date_trunc('month', p_from),
                             date_trunc('month', p_to),
                             interval '1 month') m
    ),
    inv as (
        select date_trunc('month', invoice_date)::date as month_start, sum(invoiced_myr) as v
        from public.sales_invoice_facts
        where invoice_date between p_from and p_to
          and (p_rep is null or sales_rep_code = p_rep)
        group by 1
    ),
    col as (
        select date_trunc('month', payment_date)::date as month_start, sum(applied_myr) as v
        from public.sales_collection_facts
        where payment_date between p_from and p_to
          and (p_rep is null or sales_rep_code = p_rep)
        group by 1
    ),
    ord as (
        select date_trunc('month', order_date)::date as month_start, sum(booked_myr) as v
        from public.sales_order_facts
        where order_date between p_from and p_to
          and (p_rep is null or sales_rep_code = p_rep)
        group by 1
    ),
    won as (
        select date_trunc('month', closed_on)::date as month_start, sum(won_myr) as v
        from public.sales_won_lead_facts
        where closed_on between p_from and p_to
          and (p_owner is null or owner_employee_id = p_owner)
        group by 1
    ),
    bud as (
        select date_trunc('month', budget_month)::date as month_start,
               sum(public.prorate_months(budget_revenue, budget_month, p_from, p_to)) as v
        from public.sales_budgets
        where date_trunc('month', budget_month) <= p_to
          and date_trunc('month', budget_month) + interval '1 month' > p_from
          and (p_rep is null or sales_rep_code = p_rep)
        group by 1
    ),
    tgt as (
        select date_trunc('month', target_month)::date as month_start,
               sum(public.prorate_months(target_revenue, target_month, p_from, p_to)) as v
        from public.sales_targets
        where date_trunc('month', target_month) <= p_to
          and date_trunc('month', target_month) + interval '1 month' > p_from
          and (p_owner is null or lead_owner_id = p_owner)
        group by 1
    )
    select
        m.month_start,
        m.month_start = date_trunc('month', current_date)::date,
        m.month_start between date_trunc('month', p_sel_from)::date and p_sel_to,
        case when m.is_future then null else coalesce(inv.v, 0) end,
        case when m.is_future then null else coalesce(col.v, 0) end,
        case when m.is_future then null else coalesce(ord.v, 0) end,
        case when m.is_future then null else coalesce(won.v, 0) end,
        bud.v,
        tgt.v
    from months m
    left join inv on inv.month_start = m.month_start
    left join col on col.month_start = m.month_start
    left join ord on ord.month_start = m.month_start
    left join won on won.month_start = m.month_start
    left join bud on bud.month_start = m.month_start
    left join tgt on tgt.month_start = m.month_start
    order by m.month_start
$$;


-- ─── sales_rep_totals ───────────────────────────────────────────────────────
-- The SAP-side measures per sales rep for one window: the budget gap bridge
-- (Summary) and the Rep Funnel Scorecard (Team) both read this, so they
-- cannot disagree.
--
-- Built as one UNION ALL of the fact rows, grouped once: a rep appears if they
-- have ANY of the four, and documents with no rep land in ONE row with
-- sales_rep_code null ("Unassigned") instead of vanishing (null = null never
-- joins). So the rows always add up to sales_totals for the same window.
-- Keyed by rep code, never by display name (two reps can share a name).
create or replace function public.sales_rep_totals(
    p_rep bigint,
    p_from date,
    p_to date
)
returns table (
    sales_rep_code bigint,
    sales_rep_name text,
    employee_id uuid,
    invoiced numeric,
    booked numeric,
    collected numeric,
    budget numeric
)
language sql
stable
security invoker
as $$
    with facts as (
        select f.sales_rep_code, f.invoiced_myr as inv, 0::numeric as bk, 0::numeric as col, null::numeric as bud
        from public.sales_invoice_facts f
        where f.invoice_date between p_from and p_to
          and (p_rep is null or f.sales_rep_code = p_rep)
        union all
        select f.sales_rep_code, 0, f.booked_myr, 0, null
        from public.sales_order_facts f
        where f.order_date between p_from and p_to
          and (p_rep is null or f.sales_rep_code = p_rep)
        union all
        select f.sales_rep_code, 0, 0, f.applied_myr, null
        from public.sales_collection_facts f
        where f.payment_date between p_from and p_to
          and (p_rep is null or f.sales_rep_code = p_rep)
        union all
        select f.sales_rep_code, 0, 0, 0,
               public.prorate_months(f.budget_revenue, f.budget_month, p_from, p_to)
        from public.sales_budgets f
        where date_trunc('month', f.budget_month) <= p_to
          and date_trunc('month', f.budget_month) + interval '1 month' > p_from
          and (p_rep is null or f.sales_rep_code = p_rep)
    )
    select
        x.sales_rep_code,
        sp.sales_rep_name,
        m.employee_id,
        sum(x.inv),
        sum(x.bk),
        sum(x.col),
        sum(x.bud)          -- null when the rep has no budget row: "not set"
    from facts x
    left join public.sap_sales_persons sp on sp.sales_rep_code = x.sales_rep_code
    left join public.employee_sales_rep_mapping m on m.sales_rep_code = x.sales_rep_code
    group by x.sales_rep_code, sp.sales_rep_name, m.employee_id
$$;


-- ─── sales_owner_totals ─────────────────────────────────────────────────────
-- The CRM measures per lead OWNER for one window (2026-10-23): the
-- scorecard's Pipeline Won vs Pipeline Target and Win Rate line. The same
-- shape as sales_rep_totals -- one UNION ALL of lead rows and target rows,
-- grouped once -- so an owner appears if they have either, leads with no
-- owner land in ONE row with owner_employee_id null, and the rows add up to
-- sales_pipeline_totals / sales_totals for the same window.
--   won, won_count       deals won (sales_lead_facts 'won'), closed in window
--   lost_count           deals lost or cancelled, closed in window
--   win_rate_pct         won / (won + lost) by count; null with none closed
--   target               Pipeline Target prorated to the window; null = not set
create or replace function public.sales_owner_totals(
    p_owner uuid,
    p_from date,
    p_to date
)
returns table (
    owner_employee_id uuid,
    won numeric,
    won_count bigint,
    lost_count bigint,
    win_rate_pct numeric,
    target numeric
)
language sql
stable
security invoker
as $$
    with facts as (
        select f.owner_employee_id,
               case when f.outcome = 'won' then f.won_myr else 0 end as won,
               (f.outcome = 'won')::int as is_won,
               (f.outcome = 'lost')::int as is_lost,
               null::numeric as tgt
        from public.sales_lead_facts f
        where f.outcome in ('won', 'lost')
          and f.closed_on between p_from and p_to
          and (p_owner is null or f.owner_employee_id = p_owner)
        union all
        select t.lead_owner_id, 0, 0, 0,
               public.prorate_months(t.target_revenue, t.target_month, p_from, p_to)
        from public.sales_targets t
        where date_trunc('month', t.target_month) <= p_to
          and date_trunc('month', t.target_month) + interval '1 month' > p_from
          and (p_owner is null or t.lead_owner_id = p_owner)
    )
    select
        x.owner_employee_id,
        coalesce(sum(x.won), 0),
        sum(x.is_won),
        sum(x.is_lost),
        round(sum(x.is_won)::numeric * 100 / nullif(sum(x.is_won) + sum(x.is_lost), 0), 1),
        sum(x.tgt)          -- null when the owner has no target row: "not set"
    from facts x
    group by x.owner_employee_id
$$;


-- ─── sales_pipeline_totals ──────────────────────────────────────────────────
-- The CRM pipeline for one window, from sales_lead_facts. Called for the
-- period and the comparison window, like sales_totals. `won` here equals
-- sales_totals.won by construction (both are sales_lead_facts' 'won' rows).
--
--   won, won_count, avg_deal     deals WON, closed in the window
--   lost, lost_count             deals LOST or cancelled, closed in the window;
--                                valued at what they were expected to bring
--   win_rate_pct                 won / (won + lost), by count; null with no
--                                closed deals
--   open_value, weighted_value,  the OPEN pipeline right now (a snapshot --
--   open_count                   it does not depend on the window): expected
--                                value, and expected x close probability
--   avg_days_to_won              Pipeline Cycle (2026-10-23): average days
--                                from a won lead's creation to its close,
--                                both dates in Malaysia time
--   generated_value,             Pipeline Generated (2026-10-23): leads
--   generated_count              CREATED in the window, any outcome, at their
--                                expected value -- Leads Overview's own rule
--                                (get_sales_leads_dashboard pipelineGenerated)
--   pending_sap_value,           Pending SAP Order Entry: won leads whose PO
--   pending_sap_count            no SAP order carries yet -- TODAY, at their
--                                won value (Leads Overview values it the same)
--
-- Return columns changed on 2026-10-23, and CREATE OR REPLACE cannot change
-- them, so the old version is dropped first. Nothing stores a dependency on
-- it (the RPCs call it by name at run time), so the drop is safe and this
-- file stays re-runnable.
drop function if exists public.sales_pipeline_totals(uuid, date, date);

create or replace function public.sales_pipeline_totals(
    p_owner uuid,
    p_from date,
    p_to date
)
returns table (
    won numeric,
    won_count bigint,
    avg_deal numeric,
    lost numeric,
    lost_count bigint,
    win_rate_pct numeric,
    open_value numeric,
    weighted_value numeric,
    open_count bigint,
    avg_days_to_won numeric,
    generated_value numeric,
    generated_count bigint,
    pending_sap_value numeric,
    pending_sap_count bigint
)
language sql
stable
security invoker
as $$
    select
        coalesce(sum(won_myr) filter (where outcome = 'won' and closed_on between p_from and p_to), 0),
        count(*) filter (where outcome = 'won' and closed_on between p_from and p_to),
        round(avg(won_myr) filter (where outcome = 'won' and closed_on between p_from and p_to), 2),
        coalesce(sum(expected_myr) filter (where outcome = 'lost' and closed_on between p_from and p_to), 0),
        count(*) filter (where outcome = 'lost' and closed_on between p_from and p_to),
        round(
            count(*) filter (where outcome = 'won' and closed_on between p_from and p_to)::numeric * 100
            / nullif(count(*) filter (where outcome in ('won', 'lost') and closed_on between p_from and p_to), 0),
            1),
        coalesce(sum(expected_myr) filter (where outcome = 'open'), 0),
        coalesce(sum(expected_myr * coalesce(close_probability, 0) / 100.0) filter (where outcome = 'open'), 0),
        count(*) filter (where outcome = 'open'),
        round(avg(closed_on - created_on) filter (where outcome = 'won' and closed_on between p_from and p_to), 1),
        coalesce(sum(expected_myr) filter (where created_on between p_from and p_to), 0),
        count(*) filter (where created_on between p_from and p_to),
        coalesce(sum(won_myr) filter (where pending_sap_order), 0),
        count(*) filter (where pending_sap_order)
    from public.sales_lead_facts
    where p_owner is null or owner_employee_id = p_owner
$$;


-- ─── sales_pipeline_coverage ────────────────────────────────────────────────
-- Pipeline Coverage (2026-10-23), TODAY: the Active Pipeline against the
-- Pipeline Target still to be won this fiscal year (tomorrow to the FY end,
-- prorated by sales_totals like every target). The standard B2B definition
-- -- unweighted open pipeline / quota remaining -- so the commonly quoted
-- ~3x benchmark reads against it; the weighted value is a separate figure.
-- null when no target is left (none set, or the FY is over).
create or replace function public.sales_pipeline_coverage(p_owner uuid)
returns table (
    active_value numeric,
    target_remaining numeric,
    coverage numeric
)
language sql
stable
security invoker
as $$
    with open_pipe as (
        select coalesce(sum(expected_myr), 0) as v
        from public.sales_lead_facts
        where outcome = 'open'
          and (p_owner is null or owner_employee_id = p_owner)
    ),
    tgt as (
        select t.target as v
        from public.sales_totals(
            null, p_owner,
            current_date + 1,
            (public.fiscal_year_start(current_date) + interval '1 year' - interval '1 day')::date) t
    )
    select
        open_pipe.v,
        tgt.v,
        case when tgt.v > 0 then round(open_pipe.v / tgt.v, 1) end
    from open_pipe cross join tgt
$$;


-- ─── sales_run_rate ─────────────────────────────────────────────────────────
-- The recent pace (2026-10-23): sales_totals over the last 3 COMPLETE months
-- before this one, whatever period is picked. Three months is the industry
-- convention for book-to-bill (IPC surveys) because one month of orders is
-- too volatile, and it is the pace Open Backlog (Months) and DSO are read
-- against. One copy, so those figures share the same months.
create or replace function public.sales_run_rate(p_rep bigint, p_owner uuid)
returns table (
    window_start date,
    window_end date,
    booked numeric,
    invoiced numeric
)
language sql
stable
security invoker
as $$
    select
        (date_trunc('month', current_date) - interval '3 months')::date,
        (date_trunc('month', current_date) - interval '1 day')::date,
        t.booked,
        t.invoiced
    from public.sales_totals(
        p_rep, p_owner,
        (date_trunc('month', current_date) - interval '3 months')::date,
        (date_trunc('month', current_date) - interval '1 day')::date) t
$$;


-- ─── sales_order_book_totals ────────────────────────────────────────────────
-- The order book from sales_order_book_facts (the Orders page's own rules),
-- as of TODAY: the whole open backlog, however old -- never narrowed to
-- "placed in the period" (2026-10-23, R3; until then a picked period
-- narrowed it, which also shrank Open Backlog (Months) to nonsense).
--   recent_monthly_invoiced  sales_run_rate's invoiced / 3
--   backlog_months           Open Backlog (Months): open_value / that pace
-- Signature changed on 2026-10-23 (p_has_period / p_from / p_to removed), so
-- the old version is dropped first; nothing stores a dependency on it.
drop function if exists public.sales_order_book_totals(bigint, boolean, date, date);

create or replace function public.sales_order_book_totals(p_rep bigint)
returns table (
    open_value numeric,
    open_orders bigint,
    overdue_value numeric,
    overdue_orders bigint,
    unbilled_value numeric,
    unbilled_orders bigint,
    recent_monthly_invoiced numeric,
    backlog_months numeric
)
language sql
stable
security invoker
as $$
    with book as (
        select
            coalesce(sum(order_value_myr) filter (where is_open), 0) as open_value,
            count(*) filter (where is_open) as open_orders,
            coalesce(sum(order_value_myr) filter (where is_overdue), 0) as overdue_value,
            count(*) filter (where is_overdue) as overdue_orders,
            coalesce(sum(order_value_myr) filter (where delivered_not_invoiced), 0) as unbilled_value,
            count(*) filter (where delivered_not_invoiced) as unbilled_orders
        from public.sales_order_book_facts
        where p_rep is null or sales_rep_code = p_rep
    )
    select
        book.*,
        round(rr.invoiced / 3, 2),
        case when rr.invoiced > 0 then round(book.open_value / (rr.invoiced / 3), 1) end
    from book
    cross join public.sales_run_rate(p_rep, null) rr
$$;


-- ─── ar_dso ─────────────────────────────────────────────────────────────────
-- Days Sales Outstanding, FINANCE's formula (get_finance_dashboard_rpc.sql's
-- 'dso', reconciled 2026-07 against hyrax-data-platform's KPI framework),
-- extracted so Sales and Finance compute it one way (Finance can switch to
-- this function when its report gets its own pass):
--   DSO = average receivables / invoiced in the window x days in the window
--   average receivables = (beginning + ending) / 2, where beginning is
--   derived as ending - invoiced + collected (no history of balances is
--   kept), clamped at 0.
-- null when nothing was invoiced in the window.
create or replace function public.ar_dso(
    p_ending_ar numeric,
    p_invoiced numeric,
    p_collected numeric,
    p_days numeric
)
returns numeric
language sql
immutable
as $$
    select case when p_invoiced > 0 then round(
        ((greatest(p_ending_ar - p_invoiced + p_collected, 0) + p_ending_ar) / 2.0)
        / p_invoiced * p_days, 1)
    end
$$;


-- ─── sales_receivable_totals ────────────────────────────────────────────────
-- Receivables as of TODAY (2026-10-23), from sales_receivable_facts -- which
-- carries Finance's open-invoice rule -- so these match Finance -> Invoices
-- for the same rep:
--   outstanding, invoices, customers
--   overdue_*       past the due date (days_past_due > 0)
--   critical_*      critically overdue, more than 90 days past due
--   not_due, d1_30, d31_60, d61_90, d90_plus
--                   aging buckets (Finance's arAgingData boundaries); they add
--                   up to outstanding. An invoice with no due date sits in
--                   not_due -- not known to be late, the same as the overdue
--                   test (Finance's bucket CASE would drop it into 90+; SAP
--                   requires a due date, so neither case occurs in practice)
--   dso             ar_dso over the trailing 90 days ending today: ending
--                   receivables are today's, so the window must end today
create or replace function public.sales_receivable_totals(p_rep bigint, p_owner uuid)
returns table (
    outstanding numeric,
    invoices bigint,
    customers bigint,
    overdue_value numeric,
    overdue_count bigint,
    critical_value numeric,
    critical_count bigint,
    not_due numeric,
    d1_30 numeric,
    d31_60 numeric,
    d61_90 numeric,
    d90_plus numeric,
    dso numeric
)
language sql
stable
security invoker
as $$
    with ar as (
        select
            coalesce(sum(outstanding_myr), 0) as outstanding,
            count(*) as invoices,
            count(distinct customer_code) as customers,
            coalesce(sum(outstanding_myr) filter (where days_past_due > 0), 0) as overdue_value,
            count(*) filter (where days_past_due > 0) as overdue_count,
            coalesce(sum(outstanding_myr) filter (where days_past_due > 90), 0) as critical_value,
            count(*) filter (where days_past_due > 90) as critical_count,
            coalesce(sum(outstanding_myr) filter (where coalesce(days_past_due, 0) <= 0), 0) as not_due,
            coalesce(sum(outstanding_myr) filter (where days_past_due between 1 and 30), 0) as d1_30,
            coalesce(sum(outstanding_myr) filter (where days_past_due between 31 and 60), 0) as d31_60,
            coalesce(sum(outstanding_myr) filter (where days_past_due between 61 and 90), 0) as d61_90,
            coalesce(sum(outstanding_myr) filter (where days_past_due > 90), 0) as d90_plus
        from public.sales_receivable_facts
        where p_rep is null or sales_rep_code = p_rep
    )
    select
        ar.*,
        public.ar_dso(ar.outstanding, t.invoiced, t.collected, 90)
    from ar
    cross join public.sales_totals(p_rep, p_owner, current_date - 89, current_date) t
$$;


-- ─── sales_gross_margin ─────────────────────────────────────────────────────
-- Gross Margin for one window (2026-10-23): gross profit / invoiced revenue
-- BEFORE tax, over the invoices whose gross profit is KNOWN -- the outlier
-- guard in sales_invoice_facts nulls an implausible GrosProfit, and an
-- unknown GP must not count as zero profit on real revenue.
--   gross_profit      sum of known GP
--   margin_pct        gross_profit / before-tax revenue of those invoices
--   coverage_pct      share of Invoiced Revenue whose GP is known: shown
--                     beside the margin, so nobody reads a margin built on
--                     half the invoices as the whole picture
-- Released only if the data check (supabase/diagnostics/
-- sales_gross_profit_coverage.sql) finds coverage at 95%+.
create or replace function public.sales_gross_margin(p_rep bigint, p_from date, p_to date)
returns table (
    gross_profit numeric,
    margin_pct numeric,
    coverage_pct numeric
)
language sql
stable
security invoker
as $$
    select
        coalesce(sum(gross_profit_myr), 0),
        round(sum(gross_profit_myr) * 100
              / nullif(sum(invoiced_before_tax_myr) filter (where gross_profit_myr is not null), 0), 1),
        round(sum(invoiced_myr) filter (where gross_profit_myr is not null) * 100
              / nullif(sum(invoiced_myr), 0), 1)
    from public.sales_invoice_facts
    where invoice_date between p_from and p_to
      and (p_rep is null or sales_rep_code = p_rep)
$$;


-- ─── sales_fy_progress ──────────────────────────────────────────────────────
-- Fiscal-year position for Summary's Fiscal Year Progress (2026-10-23): the
-- fiscal year containing the END of the selected period, measured up to
-- that end (or today, whichever is earlier). A closed month shows where the
-- year stood at that month's end; the current month shows today.
--
--   fy_start, fy_end, as_of
--   fytd_invoiced, fytd_budget   sales_totals from fy_start to as_of
--   fy_budget                    sales_totals budget for the whole FY (null
--                                when no budget row exists)
--   months_elapsed, months_left  months_spanned before / after as_of
--
-- Every figure is a sales_totals call, so FY to date can never be defined
-- differently from the period tiles.
create or replace function public.sales_fy_progress(
    p_rep bigint,
    p_owner uuid,
    p_start date,
    p_end date
)
returns table (
    fy_start date,
    fy_end date,
    as_of date,
    fytd_invoiced numeric,
    fytd_budget numeric,
    fy_budget numeric,
    months_elapsed numeric,
    months_left numeric
)
language sql
stable
security invoker
as $$
    with per as (
        select * from public.report_period(p_start, p_end)
    ),
    fy as (
        select
            public.fiscal_year_start(per.end_date) as fs,
            (public.fiscal_year_start(per.end_date) + interval '1 year' - interval '1 day')::date as fe,
            -- never before the FY starts (a future period has nothing to date)
            greatest(
                least(per.end_date, current_date),
                public.fiscal_year_start(per.end_date) - 1
            ) as asof
        from per
    )
    select
        fy.fs,
        fy.fe,
        fy.asof,
        ytd.invoiced,
        ytd.budget,
        full_year.budget,
        public.months_spanned(fy.fs, fy.asof),
        public.months_spanned(fy.asof + 1, fy.fe)
    from fy
    cross join lateral public.sales_totals(p_rep, p_owner, fy.fs, fy.asof) ytd
    cross join lateral public.sales_totals(p_rep, p_owner, fy.fs, fy.fe) full_year
$$;


-- ─── sales_report_meta ──────────────────────────────────────────────────────
-- The `meta` block every Sales report RPC returns, so the page labels each
-- tile and chart from the exact dates it was computed with (never
-- recomputed on the client):
--   period            { startDate, endDate, hasPeriod }
--   comparisonWindow  { startDate, endDate, isPartial }  -- what deltas compare
--   trendWindow       { startDate, endDate }             -- monthly charts
--   lastYearWindow    { startDate, endDate }             -- Same Period Last Year
--   mappingMissing    salesperson picked but not linked to a SAP rep
--   salesRepCode      the resolved rep (drill-through links filter on it)
create or replace function public.sales_report_meta(
    p_start date,
    p_end date,
    p_sales_rep_code bigint,
    p_mapping_missing boolean
)
returns json
language sql
stable
security invoker
as $$
    select json_build_object(
        'period', json_build_object(
            'startDate', per.start_date,
            'endDate', per.end_date,
            'hasPeriod', per.has_period),
        'comparisonWindow', json_build_object(
            'startDate', per.prev_start,
            'endDate', per.prev_end,
            'isPartial', per.comparison_is_partial),
        'trendWindow', json_build_object(
            'startDate', per.trend_start,
            'endDate', per.trend_end),
        'lastYearWindow', json_build_object(
            'startDate', ly.ly_start,
            'endDate', ly.ly_end),
        'mappingMissing', p_mapping_missing,
        'salesRepCode', p_sales_rep_code
    )
    from public.report_period(p_start, p_end) per
    cross join public.report_last_year(p_start, p_end) ly
$$;


-- ─── Grants ─────────────────────────────────────────────────────────────────
-- Functions are executable by PUBLIC by default; limit them to signed-in
-- users. They run with the caller's rights (SECURITY INVOKER), so this only
-- decides who may call them, not what they can see.
revoke execute on function
    public.fiscal_year_start(date),
    public.report_period(date, date),
    public.prorate_months(numeric, date, date, date),
    public.sales_report_scope(uuid),
    public.sales_totals(bigint, uuid, date, date),
    public.sales_monthly_series(bigint, uuid, date, date, date, date),
    public.sales_rep_totals(bigint, date, date),
    public.sales_report_meta(date, date, bigint, boolean),
    public.sales_pipeline_totals(uuid, date, date),
    public.sales_order_book_totals(bigint),
    public.report_last_year(date, date),
    public.months_spanned(date, date),
    public.sales_fy_progress(bigint, uuid, date, date),
    public.can_view_sales_reports(),
    public.sales_owner_totals(uuid, date, date),
    public.sales_pipeline_coverage(uuid),
    public.sales_run_rate(bigint, uuid),
    public.ar_dso(numeric, numeric, numeric, numeric),
    public.sales_receivable_totals(bigint, uuid),
    public.sales_gross_margin(bigint, date, date)
from public, anon;

grant execute on function
    public.fiscal_year_start(date),
    public.report_period(date, date),
    public.prorate_months(numeric, date, date, date),
    public.sales_report_scope(uuid),
    public.sales_totals(bigint, uuid, date, date),
    public.sales_monthly_series(bigint, uuid, date, date, date, date),
    public.sales_rep_totals(bigint, date, date),
    public.sales_report_meta(date, date, bigint, boolean),
    public.sales_pipeline_totals(uuid, date, date),
    public.sales_order_book_totals(bigint),
    public.report_last_year(date, date),
    public.months_spanned(date, date),
    public.sales_fy_progress(bigint, uuid, date, date),
    public.can_view_sales_reports(),
    public.sales_owner_totals(uuid, date, date),
    public.sales_pipeline_coverage(uuid),
    public.sales_run_rate(bigint, uuid),
    public.ar_dso(numeric, numeric, numeric, numeric),
    public.sales_receivable_totals(bigint, uuid),
    public.sales_gross_margin(bigint, date, date)
to authenticated;
