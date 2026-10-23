-- ############################################################################
-- get_sales_team -- Sales Reports, TEAM tab (per-rep, for one-to-ones)
-- (src/pages/user/sales/reports/tabs/TeamTab.jsx). Plan:
-- docs/sales/SALES-REPORTS-TABS-PLAN.md; rules: DASHBOARD-CONVENTIONS §8.
--
--   scorecard         one row per salesperson, the funnel in order:
--                       CRM  Pipeline Won vs Pipeline Target, Win Rate
--                            (sales_owner_totals, by lead owner)
--                       SAP  Sales Orders, Invoiced Revenue vs Revenue
--                            Budget, Payments Collected (sales_rep_totals --
--                            the same rows as Summary's budget bridge)
--                       TODAY  Delivered Not Invoiced, Overdue Delivery,
--                            Overdue, Critically Overdue (from the order
--                            book and receivable facts -- the Orders and
--                            Collections tabs' own rules)
--                     The two sides meet on the employee: a lead owner IS
--                     an employee, a SAP rep is mapped to one
--                     (employee_sales_rep_mapping). Full outer join, so a
--                     salesperson with only one side still gets a row, and
--                     documents / leads with no owner each land in one
--                     "Unassigned" row -- the rows add up to the tab totals.
--                     Ratios are null (not 0) with nothing to divide by.
--   grossProfitByRep  invoiced and gross profit per rep, for the PERIOD
--                     (gross profit carries sales_invoice_facts' outlier
--                     guard). Shown only with Gross Margin (plan §4).
--   overdueByRep      today's Overdue and Critically Overdue per rep
--                     (replaces Collection Rate by Rep, 2026-10-23)
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
            with sap as (
                select * from public.sales_rep_totals(sc.sales_rep_code, per.start_date, per.end_date)
            ),
            crm as (
                select * from public.sales_owner_totals(sc.owner_id, per.start_date, per.end_date)
            ),
            book as (
                select sales_rep_code,
                       coalesce(sum(order_value_myr) filter (where delivered_not_invoiced), 0) as unbilled,
                       coalesce(sum(order_value_myr) filter (where is_overdue), 0) as overdue_delivery
                from public.sales_order_book_facts
                where sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code
                group by sales_rep_code
            ),
            recv as (
                select sales_rep_code,
                       coalesce(sum(outstanding_myr) filter (where days_past_due > 0), 0) as overdue,
                       coalesce(sum(outstanding_myr) filter (where days_past_due > 90), 0) as critical
                from public.sales_receivable_facts
                where sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code
                group by sales_rep_code
            ),
            rows as (
                select
                    s.sales_rep_code,
                    coalesce(s.employee_id, c.owner_employee_id) as employee_id,
                    -- "Unassigned" only for the row with neither a rep nor an
                    -- owner; the CRM-only row of leads with no owner is named
                    -- apart so the two never read as one.
                    case
                        when s.sales_rep_name is not null then s.sales_rep_name
                        when ep.full_name is not null then ep.full_name
                        when s.sales_rep_code is not null then 'Rep ' || s.sales_rep_code
                        when c.owner_employee_id is null and s.invoiced is not null then 'Unassigned'
                        when c.owner_employee_id is null then 'Leads with no owner'
                        else 'Unknown salesperson'
                    end as name,
                    s.booked, s.invoiced, s.collected, s.budget,
                    c.won, c.won_count, c.win_rate_pct, c.target,
                    -- the row has a SAP side (sales_rep_totals always sums
                    -- invoiced, so it is never null on a real SAP row)
                    s.invoiced is not null as has_sap
                from sap s
                full outer join crm c
                  on s.employee_id is not null and c.owner_employee_id = s.employee_id
                left join public.employees_public ep on ep.id = coalesce(s.employee_id, c.owner_employee_id)
            )
            select coalesce(json_agg(json_build_object(
                'salesRepCode', r.sales_rep_code,
                'employeeId', r.employee_id,
                'name', r.name,
                'avatarUrl', p.avatar_url,
                'won', r.won,
                'wonCount', r.won_count,
                'target', r.target,
                'targetAttainmentPct', case when r.target > 0 then round(r.won / r.target * 100) end,
                'winRatePct', r.win_rate_pct,
                'booked', r.booked,
                'invoiced', r.invoiced,
                'collected', r.collected,
                'budget', r.budget,
                'attainmentPct', case when r.budget > 0 then round(r.invoiced / r.budget * 100) end,
                'unbilledValue', b.unbilled,
                'overdueDeliveryValue', b.overdue_delivery,
                'overdueValue', v.overdue,
                'criticalValue', v.critical
            ) order by coalesce(r.invoiced, 0) desc, coalesce(r.won, 0) desc, r.name), '[]'::json)
            from rows r
            -- "is not distinct from": the SAP-side Unassigned row (rep null)
            -- takes the documents with no rep, like everywhere else
            left join book b on r.has_sap and b.sales_rep_code is not distinct from r.sales_rep_code
            left join recv v on r.has_sap and v.sales_rep_code is not distinct from r.sales_rep_code
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
        ),

        'overdueByRep', (
            select coalesce(json_agg(json_build_object(
                'salesRepCode', x.sales_rep_code,
                'name', coalesce(sp.sales_rep_name, 'Unassigned'),
                'overdue', x.overdue,
                'critical', x.critical
            ) order by x.overdue desc), '[]'::json)
            from (
                select sales_rep_code,
                       sum(outstanding_myr) as overdue,
                       coalesce(sum(outstanding_myr) filter (where days_past_due > 90), 0) as critical
                from public.sales_receivable_facts
                where days_past_due > 0
                  and (sc.sales_rep_code is null or sales_rep_code = sc.sales_rep_code)
                group by sales_rep_code
                order by overdue desc
                limit 15
            ) x
            left join public.sap_sales_persons sp on sp.sales_rep_code = x.sales_rep_code
        )
    );
end;
$$;

revoke execute on function public.get_sales_team(date, date, uuid) from public, anon;
grant execute on function public.get_sales_team(date, date, uuid) to authenticated;
