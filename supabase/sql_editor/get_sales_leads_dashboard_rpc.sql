-- ############################################################################
-- get_sales_leads_dashboard -- Sales LEADS OVERVIEW
-- (src/pages/user/sales/leads/overview/LeadsOverview.jsx). Rebuilt
-- 2026-10-23 onto the shared Sales metric layer and the reporting rules in
-- docs/portal/DASHBOARD-CONVENTIONS.md §8 (R1-R13).
--
-- WHY IT WAS REWRITTEN. The old version defined Won, Lost and Generated its
-- own way in several places at once: cancelled WON leads counted as won AND
-- lost (against decision D5), the leaderboards excluded cancelled leads, the
-- trend counted stage-history transitions instead of leads, dates were
-- compared in UTC including midnight of the next day, tiles defaulted to
-- This Month while every chart and the scorecard defaulted to all time,
-- the scorecard's targets ignored the salesperson filter, and the previous
-- period was off by a day. Now every figure is a shared-layer call or a
-- grouping of sales_lead_facts with sales_pipeline_totals' own predicates,
-- so Leads Overview and the Pipeline tab of Sales Reports cannot disagree.
--
-- FILTERS (R13): the period, and the salesperson (lead owner). Nothing else:
-- client, source and product are breakdown charts on the page, and targets
-- exist per salesperson only; stage / on hold / cancelled are List filters.
-- ACCESS: SAL / MGM / superadmin (can_view_sales_reports); security invoker,
-- so sales_leads' RLS keeps a staff user to their own leads.
--
--   meta              sales_report_meta (period, comparison, trend, last year)
--   kpis              sales_pipeline_totals for the period, the comparison
--                     window and the same period last year; target from
--                     sales_totals; TODAY (R3, no comparison): open
--                     pipeline, Pipeline Coverage, Pending SAP Order Entry,
--                     On Hold, Aging 30+ days
--   wonVsTarget       monthly Pipeline Won vs Pipeline Target, trend window
--   monthlyActivity   monthly Generated / Won / Lost, trend window
--   openByStage       TODAY, open pipeline by stage (expected, weighted)
--   openByProbability TODAY, open pipeline by close probability ("Not set"
--                     for none -- the old version put those in 76-100%)
--   lostByReason      period, lost or cancelled, by reason
--   byProductType / bySource / topClients
--                     period, Generated / Won / Lost per group, top 10 by Won
--   scorecard         per salesperson: Won vs Target and Win Rate
--                     (sales_owner_totals), Generated, Lost, and Active
--                     Pipeline today; leads with no owner are one row
--
-- Run after sales_metric_facts_views.sql and sales_metric_functions.sql.
-- ############################################################################

-- The pre-2026-10-23 version took ten filters; the new one takes three. If
-- the old one survived, both would accept (p_start_date, p_end_date,
-- p_owner_id) and every call would fail as ambiguous. So drop EVERY version
-- by name, whatever its argument types are in the live database (a drop
-- that spells the old types out is skipped silently if any type differs);
-- the create below makes the current one again. Re-runnable.
do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as sig
        from pg_proc p
        where p.proname = 'get_sales_leads_dashboard'
          and p.pronamespace = 'public'::regnamespace
    loop
        execute 'drop function ' || r.sig;
    end loop;
end
$$;

create or replace function public.get_sales_leads_dashboard(
    p_start_date date default null,
    p_end_date   date default null,
    p_owner_id   uuid default null
)
returns json
language plpgsql
stable
security invoker
as $$
declare
    per record;
    cur record;
    prv record;
    ly  record;
    lyp record;
    tot record;
    cov record;
begin
    if not public.can_view_sales_reports() then
        raise exception 'Access denied';
    end if;

    select * into per from public.report_period(p_start_date, p_end_date);
    select * into cur from public.sales_pipeline_totals(p_owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_pipeline_totals(p_owner_id, per.prev_start, per.prev_end);
    select * into ly  from public.report_last_year(p_start_date, p_end_date);
    select * into lyp from public.sales_pipeline_totals(p_owner_id, ly.ly_start, ly.ly_end);
    select * into tot from public.sales_totals(null, p_owner_id, per.start_date, per.end_date);
    select * into cov from public.sales_pipeline_coverage(p_owner_id);

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, null, false),

        'kpis', json_build_object(
            'generated', cur.generated_value,
            'prevGenerated', prv.generated_value,
            'lastYearGenerated', lyp.generated_value,
            'generatedCount', cur.generated_count,
            'won', cur.won,
            'prevWon', prv.won,
            'lastYearWon', lyp.won,
            'wonCount', cur.won_count,
            'avgDeal', cur.avg_deal,
            'wonExpected', cur.won_expected,
            'target', tot.target,
            'targetAttainmentPct',
                case when tot.target > 0 then round(cur.won / tot.target * 100) end,
            'lost', cur.lost,
            'lostCount', cur.lost_count,
            'winRatePct', cur.win_rate_pct,
            'prevWinRatePct', prv.win_rate_pct,
            'avgDaysToWon', cur.avg_days_to_won,
            -- TODAY
            'openValue', cur.open_value,
            'weightedValue', cur.weighted_value,
            'openCount', cur.open_count,
            'pipelineCoverage', cov.coverage,
            'targetRemaining', cov.target_remaining,
            'pendingSapValue', cur.pending_sap_value,
            'pendingSapCount', cur.pending_sap_count,
            'onHoldValue', cur.on_hold_value,
            'onHoldCount', cur.on_hold_count,
            'agingValue', cur.aging_value,
            'agingCount', cur.aging_count
        ),

        'wonVsTarget', (
            select coalesce(json_agg(json_build_object(
                'period', to_char(s.month_start, 'YYYY-MM'),
                'isPartial', s.is_partial,
                'inPeriod', s.in_period,
                'won', s.won,
                'target', s.target
            ) order by s.month_start), '[]'::json)
            from public.sales_monthly_series(
                null, p_owner_id, per.trend_start, per.trend_end,
                per.start_date, per.end_date) s
        ),

        'monthlyActivity', (
            select coalesce(json_agg(json_build_object(
                'period', to_char(s.month_start, 'YYYY-MM'),
                'isPartial', s.is_partial,
                'inPeriod', s.in_period,
                'generated', s.generated,
                'won', s.won,
                'lost', s.lost
            ) order by s.month_start), '[]'::json)
            from public.sales_monthly_series(
                null, p_owner_id, per.trend_start, per.trend_end,
                per.start_date, per.end_date) s
        ),

        'openByStage', (
            select coalesce(json_agg(json_build_object(
                'name', x.stage, 'value', x.expected, 'weighted', x.weighted, 'count', x.deals
            ) order by x.stage_order), '[]'::json)
            from (
                select
                    stage,
                    case stage
                        when 'DISCOVERY'   then 1
                        when 'SAMPLE_TEST' then 2
                        when 'PROPOSAL'    then 3
                        when 'NEGOTIATION' then 4
                        else 5
                    end as stage_order,
                    coalesce(sum(expected_myr), 0) as expected,
                    coalesce(sum(expected_myr * coalesce(close_probability, 0) / 100.0), 0) as weighted,
                    count(*) as deals
                from public.sales_lead_facts
                where outcome = 'open'
                  and (p_owner_id is null or owner_employee_id = p_owner_id)
                group by stage
            ) x
        ),

        'openByProbability', (
            select coalesce(json_agg(json_build_object(
                'name', x.bucket, 'value', x.expected, 'count', x.deals
            ) order by x.bucket_order), '[]'::json)
            from (
                select
                    case
                        when close_probability is null then 'Not set'
                        when close_probability <= 25 then '0-25% (Low)'
                        when close_probability <= 50 then '26-50% (Medium)'
                        when close_probability <= 75 then '51-75% (High)'
                        else '76-100% (Commit)'
                    end as bucket,
                    case
                        when close_probability is null then 5
                        when close_probability <= 25 then 1
                        when close_probability <= 50 then 2
                        when close_probability <= 75 then 3
                        else 4
                    end as bucket_order,
                    coalesce(sum(expected_myr), 0) as expected,
                    count(*) as deals
                from public.sales_lead_facts
                where outcome = 'open'
                  and (p_owner_id is null or owner_employee_id = p_owner_id)
                group by 1, 2
            ) x
        ),

        'lostByReason', (
            select coalesce(json_agg(json_build_object(
                'name', x.name, 'value', x.lost, 'count', x.deals
            ) order by x.lost desc), '[]'::json)
            from (
                select lost_reason as name,
                       coalesce(sum(expected_myr), 0) as lost,
                       count(*) as deals
                from public.sales_lead_facts
                where outcome = 'lost'
                  and closed_on between per.start_date and per.end_date
                  and (p_owner_id is null or owner_employee_id = p_owner_id)
                group by 1
            ) x
        ),

        -- Generated / Won / Lost per group: the same three predicates as
        -- sales_pipeline_totals (created_on in the period; won / lost with
        -- closed_on in the period), so each chart's bars add up to the tiles.
        'byProductType', (
            select coalesce(json_agg(json_build_object(
                'name', x.name, 'generated', x.generated, 'won', x.won, 'lost', x.lost
            ) order by x.won desc, x.generated desc, x.name), '[]'::json)
            from (
                select coalesce(product_type::text, 'Unspecified') as name,
                       coalesce(sum(expected_myr) filter (where created_on between per.start_date and per.end_date), 0) as generated,
                       coalesce(sum(won_myr) filter (where outcome = 'won' and closed_on between per.start_date and per.end_date), 0) as won,
                       coalesce(sum(expected_myr) filter (where outcome = 'lost' and closed_on between per.start_date and per.end_date), 0) as lost
                from public.sales_lead_facts
                where (p_owner_id is null or owner_employee_id = p_owner_id)
                group by 1
            ) x
            where x.generated > 0 or x.won > 0 or x.lost > 0
        ),

        'bySource', (
            select coalesce(json_agg(json_build_object(
                'name', x.name, 'generated', x.generated, 'won', x.won, 'lost', x.lost
            ) order by x.won desc, x.generated desc, x.name), '[]'::json)
            from (
                select lead_source as name,
                       coalesce(sum(expected_myr) filter (where created_on between per.start_date and per.end_date), 0) as generated,
                       coalesce(sum(won_myr) filter (where outcome = 'won' and closed_on between per.start_date and per.end_date), 0) as won,
                       coalesce(sum(expected_myr) filter (where outcome = 'lost' and closed_on between per.start_date and per.end_date), 0) as lost
                from public.sales_lead_facts
                where (p_owner_id is null or owner_employee_id = p_owner_id)
                group by 1
            ) x
            where x.generated > 0 or x.won > 0 or x.lost > 0
        ),

        'topClients', (
            select coalesce(json_agg(json_build_object(
                'name', x.name, 'generated', x.generated, 'won', x.won, 'lost', x.lost
            ) order by x.won desc, x.generated desc, x.name), '[]'::json)
            from (
                select account_key,
                       max(coalesce(account_name, 'Unknown')) as name,
                       coalesce(sum(expected_myr) filter (where created_on between per.start_date and per.end_date), 0) as generated,
                       coalesce(sum(won_myr) filter (where outcome = 'won' and closed_on between per.start_date and per.end_date), 0) as won,
                       coalesce(sum(expected_myr) filter (where outcome = 'lost' and closed_on between per.start_date and per.end_date), 0) as lost
                from public.sales_lead_facts
                where (p_owner_id is null or owner_employee_id = p_owner_id)
                group by account_key
                having coalesce(sum(expected_myr) filter (where created_on between per.start_date and per.end_date), 0) > 0
                    or coalesce(sum(won_myr) filter (where outcome = 'won' and closed_on between per.start_date and per.end_date), 0) > 0
                    or coalesce(sum(expected_myr) filter (where outcome = 'lost' and closed_on between per.start_date and per.end_date), 0) > 0
                order by won desc, generated desc, name
                limit 10
            ) x
        ),

        'scorecard', (
            with ot as (
                select * from public.sales_owner_totals(p_owner_id, per.start_date, per.end_date)
            ),
            lf as (
                select owner_employee_id,
                       coalesce(sum(expected_myr) filter (where created_on between per.start_date and per.end_date), 0) as generated,
                       coalesce(sum(expected_myr) filter (where outcome = 'lost' and closed_on between per.start_date and per.end_date), 0) as lost,
                       coalesce(sum(expected_myr) filter (where outcome = 'open'), 0) as open_value
                from public.sales_lead_facts
                where p_owner_id is null or owner_employee_id = p_owner_id
                group by owner_employee_id
            ),
            rows as (
                -- full outer join on the owner, with the nil UUID standing in
                -- for "no owner" (a FULL JOIN needs a hashable condition)
                select
                    coalesce(ot.owner_employee_id, lf.owner_employee_id) as owner_id,
                    ot.won, ot.won_count, ot.win_rate_pct, ot.target,
                    lf.generated, lf.lost, lf.open_value
                from ot
                full outer join lf
                  on coalesce(ot.owner_employee_id, '00000000-0000-0000-0000-000000000000'::uuid)
                   = coalesce(lf.owner_employee_id, '00000000-0000-0000-0000-000000000000'::uuid)
            )
            select coalesce(json_agg(json_build_object(
                'ownerId', r.owner_id,
                'name', coalesce(e.full_name,
                    case when r.owner_id is null then 'Leads with no owner' else 'Unknown salesperson' end),
                'avatarUrl', p.avatar_url,
                'won', coalesce(r.won, 0),
                'wonCount', coalesce(r.won_count, 0),
                'target', r.target,
                'targetAttainmentPct', case when r.target > 0 then round(coalesce(r.won, 0) / r.target * 100) end,
                'winRatePct', r.win_rate_pct,
                'generated', coalesce(r.generated, 0),
                'lost', coalesce(r.lost, 0),
                'openValue', coalesce(r.open_value, 0)
            ) order by coalesce(r.won, 0) desc, coalesce(r.generated, 0) desc, e.full_name), '[]'::json)
            from rows r
            left join public.employees_public e on e.id = r.owner_id
            left join public.profiles p on p.id = e.profile_id
            where coalesce(r.won, 0) > 0 or coalesce(r.target, 0) > 0 or coalesce(r.generated, 0) > 0
               or coalesce(r.lost, 0) > 0 or coalesce(r.open_value, 0) > 0
        )
    );
end;
$$;

revoke execute on function public.get_sales_leads_dashboard(date, date, uuid) from public, anon;
grant execute on function public.get_sales_leads_dashboard(date, date, uuid) to authenticated;
