-- ############################################################################
-- get_sales_pipeline -- Sales Reports, PIPELINE tab (CRM)
-- (src/pages/user/sales/reports/tabs/PipelineTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md.
--
-- For meetings: are we creating and winning enough, against target, why do
-- we lose, and what is open. Daily pipeline work (aging, on hold, the list
-- of leads to chase) stays on Leads Overview. Every figure comes from
-- sales_lead_facts through the shared functions; the salesperson filter is
-- the lead OWNER (CRM side).
--
--   kpis           sales_pipeline_totals for the period, the comparison
--                  window and the same period last year (generated, won,
--                  lost, win rate, avg deal, cycle) + target from
--                  sales_totals. TODAY (R3, no comparison): the open
--                  pipeline, Pending SAP Order Entry, and Pipeline Coverage
--                  (sales_pipeline_coverage)
--   wonVsTarget    monthly won vs target, trend window
--   wonByProductType / wonBySource / topClients   won in the period
--   lostByReason   lost or cancelled in the period, by reason
--   openByStage    the open pipeline TODAY, by stage (snapshot)
--
-- Run after sales_metric_facts_views.sql and sales_metric_functions.sql.
-- ############################################################################

create or replace function public.get_sales_pipeline(
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
    sc  record;
    per record;
    cur record;
    prv record;
    tot record;
    ly  record;
    lyp record;
    cov record;
begin
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    select * into cur from public.sales_pipeline_totals(sc.owner_id, per.start_date, per.end_date);
    select * into prv from public.sales_pipeline_totals(sc.owner_id, per.prev_start, per.prev_end);
    select * into tot from public.sales_totals(sc.sales_rep_code, sc.owner_id, per.start_date, per.end_date);
    select * into ly from public.report_last_year(p_start_date, p_end_date);
    select * into lyp from public.sales_pipeline_totals(sc.owner_id, ly.ly_start, ly.ly_end);
    select * into cov from public.sales_pipeline_coverage(sc.owner_id);

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, sc.sales_rep_code, sc.mapping_missing),

        'kpis', json_build_object(
            'won', cur.won,
            'prevWon', prv.won,
            'wonCount', cur.won_count,
            'avgDeal', cur.avg_deal,
            'target', tot.target,
            'targetAttainmentPct',
                case when tot.target > 0 then round(cur.won / tot.target * 100) end,
            'lost', cur.lost,
            'prevLost', prv.lost,
            'lostCount', cur.lost_count,
            'winRatePct', cur.win_rate_pct,
            'prevWinRatePct', prv.win_rate_pct,
            'openValue', cur.open_value,
            'weightedValue', cur.weighted_value,
            'openCount', cur.open_count,
            'avgDaysToWon', cur.avg_days_to_won,
            'lastYearWon', lyp.won,
            'lastYearLost', lyp.lost,
            'generated', cur.generated_value,
            'prevGenerated', prv.generated_value,
            'lastYearGenerated', lyp.generated_value,
            'generatedCount', cur.generated_count,
            'pendingSapValue', cur.pending_sap_value,
            'pendingSapCount', cur.pending_sap_count,
            'pipelineCoverage', cov.coverage,
            'targetRemaining', cov.target_remaining
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
                sc.sales_rep_code, sc.owner_id,
                per.trend_start, per.trend_end,
                per.start_date, per.end_date) s
        ),

        'wonByProductType', (
            select coalesce(json_agg(json_build_object('name', x.name, 'value', x.won)
                order by x.won desc), '[]'::json)
            from (
                select coalesce(product_type::text, 'Unspecified') as name, sum(won_myr) as won
                from public.sales_lead_facts
                where outcome = 'won'
                  and closed_on between per.start_date and per.end_date
                  and (sc.owner_id is null or owner_employee_id = sc.owner_id)
                group by 1
            ) x
        ),

        'wonBySource', (
            select coalesce(json_agg(json_build_object('name', x.name, 'value', x.won)
                order by x.won desc), '[]'::json)
            from (
                select lead_source as name, sum(won_myr) as won
                from public.sales_lead_facts
                where outcome = 'won'
                  and closed_on between per.start_date and per.end_date
                  and (sc.owner_id is null or owner_employee_id = sc.owner_id)
                group by 1
            ) x
        ),

        'topClients', (
            select coalesce(json_agg(json_build_object('name', x.name, 'value', x.won)
                order by x.won desc), '[]'::json)
            from (
                select account_key, max(coalesce(account_name, 'Unknown')) as name, sum(won_myr) as won
                from public.sales_lead_facts
                where outcome = 'won'
                  and closed_on between per.start_date and per.end_date
                  and (sc.owner_id is null or owner_employee_id = sc.owner_id)
                group by account_key
                order by won desc
                limit 10
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
                  and (sc.owner_id is null or owner_employee_id = sc.owner_id)
                group by 1
            ) x
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
                  and (sc.owner_id is null or owner_employee_id = sc.owner_id)
                group by stage
            ) x
        )
    );
end;
$$;

revoke execute on function public.get_sales_pipeline(date, date, uuid) from public, anon;
grant execute on function public.get_sales_pipeline(date, date, uuid) to authenticated;
