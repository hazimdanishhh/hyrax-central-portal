-- ############################################################################
-- get_sales_team -- Sales Reports, TEAM tab (per-rep, for one-to-ones)
-- (src/pages/user/sales/reports/tabs/TeamTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md §3-§4.
--
--   scorecard         one row per sales rep from sales_rep_totals -- the
--                     same rows Summary's budget bridge is built from, so the
--                     two can't disagree. Documents with no rep are one
--                     "Unassigned" row, so the rows add up to the totals.
--                     attainment / collection rate are null (not 0) when
--                     there is no budget / nothing invoiced.
--   grossProfitByRep  invoiced and gross profit per rep, for the PERIOD (it
--                     was all-time when unfiltered on the old page). Gross
--                     profit carries the outlier guard from
--                     sales_invoice_facts.gross_profit_myr.
--
-- Run after sales_metric_facts_views.sql and sales_metric_functions.sql.
-- ############################################################################

create or replace function public.get_sales_team(
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
begin
    select * into sc from public.sales_report_scope(p_owner_id);
    select * into per from public.report_period(p_start_date, p_end_date);

    return json_build_object(
        'meta', public.sales_report_meta(p_start_date, p_end_date, sc.sales_rep_code, sc.mapping_missing),

        'scorecard', (
            select coalesce(json_agg(json_build_object(
                'salesRepCode', r.sales_rep_code,
                'employeeId', r.employee_id,
                'name', coalesce(r.sales_rep_name, 'Unassigned'),
                'avatarUrl', p.avatar_url,
                'booked', r.booked,
                'invoiced', r.invoiced,
                'collected', r.collected,
                'budget', r.budget,
                'attainmentPct',
                    case when r.budget > 0 then round(r.invoiced / r.budget * 100) end,
                'collectionRatePct',
                    case when r.invoiced > 0 then round(r.collected / r.invoiced * 100, 1) end
            ) order by r.invoiced desc, r.sales_rep_code), '[]'::json)
            from public.sales_rep_totals(sc.sales_rep_code, per.start_date, per.end_date) r
            left join public.employees e on e.id = r.employee_id
            left join public.profiles p on p.id = e.profile_id
        ),

        'grossProfitByRep', (
            select coalesce(json_agg(json_build_object(
                'salesRepCode', x.sales_rep_code,
                'name', coalesce(sp.sales_rep_name, 'Unassigned'),
                'invoiced', x.invoiced,
                'grossProfit', x.gross_profit
            ) order by x.invoiced desc), '[]'::json)
            from (
                select sales_rep_code,
                       sum(invoiced_myr) as invoiced,
                       coalesce(sum(gross_profit_myr), 0) as gross_profit
                from public.sales_invoice_facts
                where invoice_date between per.start_date and per.end_date
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by sales_rep_code
                order by invoiced desc
                limit 15
            ) x
            left join public.sap_sales_persons sp on sp.sales_rep_code = x.sales_rep_code
        )
    );
end;
$$;

revoke execute on function public.get_sales_team(date, date, uuid) from public, anon;
grant execute on function public.get_sales_team(date, date, uuid) to authenticated;
