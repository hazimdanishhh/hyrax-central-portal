create or replace function get_sales_leads_dashboard(
    p_owner_id uuid default null,
    p_client_id uuid default null,
    p_sap_customer_code text default null,
    p_source_id bigint default null,
    p_stage sales_leads_stage default null,
    p_start_date date default null,
    p_end_date date default null,
    p_is_on_hold boolean default null,
    p_is_cancelled boolean default null,
    p_product_type public.product_type default null
)
returns json
language plpgsql
as
$$
declare
    result json;
    v_interval integer;
    v_prev_start_date date;
    v_prev_end_date date;
    v_caller_role text;
    v_caller_department text;
begin

-- 0. Authorization guard (2026-09) -- this RPC previously had none at all;
-- added now that MGM legitimately calls it via the Leads Overview page too,
-- mirroring get_sales_reports_dashboard_rpc.sql's existing SAL/MGM guard.
select r.name, d.sub
  into v_caller_role, v_caller_department
from profiles p
join roles r on r.id = p.role_id
join departments d on d.id = p.department_id
where p.id = auth.uid();

if v_caller_role is null then
    raise exception 'Access denied';
end if;

if v_caller_role <> 'superadmin' and v_caller_department not in ('SAL', 'MGM') then
    raise exception 'Access denied';
end if;

-- 1. Calculate the Previous Period for Deltas
if p_start_date is not null and p_end_date is not null then
    v_interval := p_end_date - p_start_date;
    v_prev_end_date := p_start_date - 1;
    v_prev_start_date := v_prev_end_date - v_interval;
end if;

-- 1. Find the exact date deals were closed
with closing_dates as (
    select 
        lead_id, 
        max(changed_at) as closed_date
    from sales_leads_stage_history
    where new_stage in ('WON', 'LOST')
    group by lead_id
),

-- 2. Base filter without dates
base_leads as (
    select
        sl.*,
        coalesce(cd.closed_date, case when sl.stage in ('WON', 'LOST') or sl.is_cancelled then sl.updated_at else null end) as closed_date,
        -- Account identity (2026-08): a lead references exactly one of a
        -- real SAP customer (sap_customer_code) or a native Prospect
        -- (client_id), never both -- see clients_sap_customer_link_migration
        -- .sql / sales_leads_sap_customer_link_migration.sql. Computed once
        -- here so every downstream chart (e.g. topClientsData below) can
        -- treat both cases uniformly instead of re-joining per chart.
        coalesce(sl.client_id::text, sl.sap_customer_code) as account_key,
        coalesce(c.name, sc.customer_name) as account_name
    from sales_leads sl
    left join closing_dates cd on cd.lead_id = sl.id
    left join clients c on c.id = sl.client_id
    left join sap_customers sc on sc.customer_code = sl.sap_customer_code
    where
        (p_owner_id is null or sl.lead_owner_id = p_owner_id)
        and (p_client_id is null or sl.client_id = p_client_id)
        and (p_sap_customer_code is null or sl.sap_customer_code = p_sap_customer_code)
        and (p_source_id is null or sl.lead_source_type_id = p_source_id)
        and (p_stage is null or sl.stage = p_stage)
        and (p_is_on_hold is null or sl.is_on_hold = p_is_on_hold)
        and (p_is_cancelled is null or sl.is_cancelled = p_is_cancelled)
        and (p_product_type is null or sl.product_type = p_product_type)
)

select json_build_object(

    'kpis', (
        select json_build_object(
            'totalLeadsCreated', count(*) filter (
                where (p_start_date is null or created_at >= p_start_date)
                and (p_end_date is null or created_at <= p_end_date + interval '1 day')
            ),
            'pipelineGenerated', coalesce(sum(expected_revenue) filter (
                where (p_start_date is null or created_at >= p_start_date)
                and (p_end_date is null or created_at <= p_end_date + interval '1 day')
            ), 0),

            'wonLeads', count(*) filter (
                where stage = 'WON' 
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ),
            'wonRevenue', coalesce(sum(actual_revenue) filter (
                where stage = 'WON' 
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ), 0),
            
            'avgDealSize', coalesce(round(avg(actual_revenue) filter (
                where stage = 'WON'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            )), 0),

            -- Current backlog, deliberately NOT date-scoped (no p_start_date/
            -- p_end_date predicate) -- this counts WON leads still sitting
            -- unactioned in SAP right now, not "became pending in period".
            -- Same reasoning as Finance's overdueValue KPI. Still respects
            -- base_leads' own non-date filters (owner/client/stage/etc), same
            -- as every other KPI here. Mirrors
            -- sales_leads_with_closed_date.sql's pending_sap_order column --
            -- keep both in sync if this predicate ever changes.
            'wonLeadsPendingSapOrderCount', count(*) filter (
                where stage = 'WON'
                and po_number is not null
                and not exists (
                    select 1 from public.sap_sales_orders sso
                    where sso.customer_ref = base_leads.po_number
                )
            ),

            'lostLeads', count(*) filter (
                where (stage = 'LOST' or is_cancelled)
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ),
            'lostRevenue', coalesce(sum(expected_revenue) filter (
                where (stage = 'LOST' or is_cancelled)
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ), 0),
            
            'winRate', coalesce(
                round(
                    (count(*) filter (
                        where stage = 'WON'
                        and (p_start_date is null or closed_date >= p_start_date)
                        and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                    )::numeric / 
                    nullif(count(*) filter (
                        where stage in ('WON', 'LOST')
                        and (p_start_date is null or closed_date >= p_start_date)
                        and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                    ), 0)) * 100, 
                1), 
            0),

            'activeLeads', count(*) filter (where stage not in ('WON', 'LOST') and not is_cancelled),
            'activePipelineValue', coalesce(sum(expected_revenue) filter (where stage not in ('WON', 'LOST') and not is_cancelled), 0),
            'weightedPipelineValue', coalesce(sum(expected_revenue * (close_probability / 100.0)) filter (where stage not in ('WON', 'LOST') and not is_cancelled), 0),
            
            'avgDaysToClose', coalesce(
                round(
                    (avg(extract(epoch from (closed_date - created_at))/86400) filter (
                        where stage = 'WON'
                        and (p_start_date is null or closed_date >= p_start_date)
                        and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                    ))::numeric, 
                    1
                ), 
            0),

            'forecastVariance', coalesce(
                sum(actual_revenue) filter (
                    where stage = 'WON'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ) - 
                sum(expected_revenue) filter (
                    where stage = 'WON'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ), 0
            ),

            'expectedRevenueOfWonDeals', coalesce(sum(expected_revenue) filter (
                where stage = 'WON' 
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ), 0),

            'avgGeneratedDealSize', coalesce(round(avg(expected_revenue) filter (
                where (p_start_date is null or created_at >= p_start_date)
                and (p_end_date is null or created_at <= p_end_date + interval '1 day')
            )), 0),
            
            'avgGeneratedProbability', coalesce(round(avg(close_probability) filter (
                where (p_start_date is null or created_at >= p_start_date)
                and (p_end_date is null or created_at <= p_end_date + interval '1 day')
            )), 0),

            'fastTrackDeals', count(*) filter (
                where stage = 'WON'
                and (p_start_date is null or created_at >= p_start_date)
                and (p_end_date is null or created_at <= p_end_date + interval '1 day')
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ),

            'negotiationPipeline', coalesce(sum(expected_revenue) filter (
                where stage = 'NEGOTIATION' and not is_cancelled and not is_on_hold
            ), 0),

            'onHoldPipeline', coalesce(sum(expected_revenue) filter (
                where is_on_hold and stage not in ('WON', 'LOST') and not is_cancelled
            ), 0),

            'avgLostDealSize', coalesce(round(avg(expected_revenue) filter (
                where stage = 'LOST'
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            )), 0),

            'avgLostCycle', coalesce(round(
                (avg(extract(epoch from (closed_date - created_at))/86400) filter (
                    where stage = 'LOST'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ))::numeric, 1
            ), 0),

            'cancelledLeads', count(*) filter (
                where is_cancelled
                and (p_start_date is null or closed_date >= p_start_date)
                and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
            ),

            'prevPipelineGenerated', case 
                when p_start_date is null then null 
                else coalesce(sum(expected_revenue) filter (
                    where created_at >= v_prev_start_date
                    and created_at <= v_prev_end_date + interval '1 day'
                ), 0) 
            end,
            
            'prevWonRevenue', case 
                when p_start_date is null then null 
                else coalesce(sum(actual_revenue) filter (
                    where stage = 'WON' 
                    and closed_date >= v_prev_start_date
                    and closed_date <= v_prev_end_date + interval '1 day'
                ), 0) 
            end
        )
        from base_leads
    ),

    'stageData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                stage as name,
                count(*) as count,
                coalesce(sum(case when stage = 'WON' then actual_revenue else expected_revenue end), 0) as total_value
            from base_leads
            where not is_cancelled 
            and (
                (p_start_date is null) or 
                (created_at >= p_start_date and created_at <= p_end_date + interval '1 day') or
                (closed_date >= p_start_date and closed_date <= p_end_date + interval '1 day')
            )
            group by stage
            order by stage
        ) x
    ),

    'probabilityHealthData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select 
                case 
                    when close_probability <= 25 then '0-25% (Low)'
                    when close_probability <= 50 then '26-50% (Medium)'
                    when close_probability <= 75 then '51-75% (High)'
                    else '76-100% (Commit)'
                end as name,
                count(*) as count,
                coalesce(sum(expected_revenue), 0) as total_value
            from base_leads
            where stage not in ('WON', 'LOST') and not is_cancelled
            group by 1
            order by 1
        ) x
    ),

    'lossReasonData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select 
                coalesce(lr.name, 'No Reason Given') as name,
                count(*) as count,
                coalesce(sum(fl.expected_revenue), 0) as total_lost_value
            from base_leads fl
            left join sales_leads_lose_reasons lr on lr.id = fl.lose_reason_id
            where fl.stage = 'LOST'
            and (
                (p_start_date is null) or 
                (fl.created_at >= p_start_date and fl.created_at <= p_end_date + interval '1 day') or
                (fl.closed_date >= p_start_date and fl.closed_date <= p_end_date + interval '1 day')
            )
            group by coalesce(lr.name, 'No Reason Given')
            order by total_lost_value desc
        ) x
    ),

    'trendData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select 
                to_char(date_trunc('month', h.changed_at), 'YYYY-MM') as period,
                count(*) filter (where h.previous_stage is null) as leads_created,
                coalesce(sum(h.expected_revenue) filter (where h.previous_stage is null), 0) as pipeline_generated,
                count(*) filter (where h.new_stage = 'WON') as deals_won,
                coalesce(sum(fl.actual_revenue) filter (where h.new_stage = 'WON'), 0) as revenue_won,
                count(*) filter (where h.new_stage = 'LOST') as deals_lost,
                coalesce(sum(h.expected_revenue) filter (where h.new_stage = 'LOST'), 0) as revenue_lost
            from sales_leads_stage_history h
            join base_leads fl on fl.id = h.lead_id 
            where 
                (p_start_date is null or h.changed_at >= p_start_date)
                and (p_end_date is null or h.changed_at <= p_end_date + interval '1 day')
            group by 1
            order by 1
        ) x
    ),

    'productTypeData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                coalesce(product_type::text, 'Unspecified') as name,
                coalesce(sum(expected_revenue), 0) as active_in_period,
                coalesce(sum(expected_revenue) filter (
                    where (p_start_date is null or created_at >= p_start_date)
                    and (p_end_date is null or created_at <= p_end_date + interval '1 day')
                ), 0) as pipeline_generated,
                coalesce(sum(expected_revenue) filter (
                    where stage = 'WON'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ), 0) as won_expected,
                coalesce(sum(actual_revenue) filter (
                    where stage = 'WON'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ), 0) as won_actual,
                coalesce(sum(expected_revenue) filter (
                    where stage = 'LOST'
                    and (p_start_date is null or closed_date >= p_start_date)
                    and (p_end_date is null or closed_date <= p_end_date + interval '1 day')
                ), 0) as lost_revenue
            from base_leads
            where not is_cancelled
            and (
                (p_start_date is null or closed_date is null or closed_date >= p_start_date)
                and
                (p_end_date is null or created_at < p_end_date + interval '1 day')
            )
            group by coalesce(product_type::text, 'Unspecified')
            order by won_actual desc, active_in_period desc
        ) x
    ),

    'leadOwnerData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                e.full_name as name,
                coalesce(sum(fl.expected_revenue), 0) as active_in_period,
                coalesce(sum(fl.expected_revenue) filter (
                    where (p_start_date is null or fl.created_at >= p_start_date)
                    and (p_end_date is null or fl.created_at <= p_end_date + interval '1 day')
                ), 0) as pipeline_generated,
                coalesce(sum(fl.expected_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_expected,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_actual,
                coalesce(sum(fl.expected_revenue) filter (
                    where fl.stage = 'LOST'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as lost_revenue
            from base_leads fl
            join employees e on e.id = fl.lead_owner_id
            where not fl.is_cancelled
            and (
                (p_start_date is null or fl.closed_date is null or fl.closed_date >= p_start_date)
                and
                (p_end_date is null or fl.created_at < p_end_date + interval '1 day')
            )
            group by e.full_name
            order by won_actual desc, active_in_period desc
            limit 10
        ) x
    ),

    'scorecardData', (
        with rep_actuals as (
            -- 1. Get the actual WON revenue for the exact filtered period
            select 
                fl.lead_owner_id,
                e.full_name as rep_name,
                p.avatar_url,
                coalesce(sum(fl.actual_revenue), 0) as actual_revenue
            from base_leads fl
            join employees e on e.id = fl.lead_owner_id
            left join profiles p on p.id = e.profile_id
            where fl.stage = 'WON'
            and (p_start_date is null or fl.closed_date >= p_start_date)
            and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
            group by 1, 2, 3
        ),
        target_math as (
            -- 2. Calculate the prorated targets for the overlapping months
            select 
                t.lead_owner_id,
                sum(
                    t.target_revenue * (
                        case 
                            when p_start_date is null and p_end_date is null then 1 -- All time = full target
                            else
                                greatest(0, 
                                    (least(coalesce(p_end_date, '2099-12-31'::date), (t.target_month + interval '1 month' - interval '1 day')::date) - 
                                    greatest(coalesce(p_start_date, '1900-01-01'::date), t.target_month)) + 1
                                ) / extract(day from (t.target_month + interval '1 month' - interval '1 day'))
                        end
                    )
                ) as prorated_target
            from sales_targets t
            group by 1
        )
        -- 3. Combine them into the final scorecard
        select coalesce(json_agg(
            json_build_object(
                'lead_owner_id', coalesce(a.lead_owner_id, t.lead_owner_id),
                'rep_name', coalesce(a.rep_name, e.full_name),
                'avatar_url', coalesce(a.avatar_url, p.avatar_url),
                'actual_revenue', coalesce(a.actual_revenue, 0),
                'target_revenue', coalesce(t.prorated_target, 0),
                'attainment_percentage', case 
                    when coalesce(t.prorated_target, 0) > 0 then round((coalesce(a.actual_revenue, 0) / t.prorated_target) * 100)
                    else 0 
                end
            ) order by coalesce(a.actual_revenue, 0) desc
        ), '[]'::json)
        from rep_actuals a
        full outer join target_math t on t.lead_owner_id = a.lead_owner_id
        left join employees e on e.id = coalesce(a.lead_owner_id, t.lead_owner_id)
        left join profiles p on p.id = e.profile_id
        where coalesce(a.actual_revenue, 0) > 0 or coalesce(t.prorated_target, 0) > 0
    ),

    'sourceData', (
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                lst.name,
                coalesce(sum(fl.expected_revenue), 0) as active_in_period,
                coalesce(sum(fl.expected_revenue) filter (
                    where (p_start_date is null or fl.created_at >= p_start_date)
                    and (p_end_date is null or fl.created_at <= p_end_date + interval '1 day')
                ), 0) as pipeline_generated,
                coalesce(sum(fl.expected_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_expected,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_actual,
                coalesce(sum(fl.expected_revenue) filter (
                    where fl.stage = 'LOST'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as lost_revenue
            from base_leads fl
            join lead_source_types lst on lst.id = fl.lead_source_type_id
            where not fl.is_cancelled
            and (
                (p_start_date is null or fl.closed_date is null or fl.closed_date >= p_start_date)
                and
                (p_end_date is null or fl.created_at < p_end_date + interval '1 day')
            )
            group by lst.name
            order by won_actual desc, active_in_period desc
        ) x
    ),

    'topClientsData', (
        -- Blends both account kinds via base_leads.account_name/account_key
        -- (see the CTE above) -- previously an inner `join clients` silently
        -- dropped every SAP-referenced lead (client_id is null) from this
        -- chart entirely once that became possible (2026-08).
        select coalesce(json_agg(x), '[]'::json)
        from (
            select
                fl.account_name as name,
                coalesce(sum(fl.expected_revenue), 0) as active_in_period,
                coalesce(sum(fl.expected_revenue) filter (
                    where (p_start_date is null or fl.created_at >= p_start_date)
                    and (p_end_date is null or fl.created_at <= p_end_date + interval '1 day')
                ), 0) as pipeline_generated,
                coalesce(sum(fl.expected_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_expected,
                coalesce(sum(fl.actual_revenue) filter (
                    where fl.stage = 'WON'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as won_actual,
                coalesce(sum(fl.expected_revenue) filter (
                    where fl.stage = 'LOST'
                    and (p_start_date is null or fl.closed_date >= p_start_date)
                    and (p_end_date is null or fl.closed_date <= p_end_date + interval '1 day')
                ), 0) as lost_revenue
            from base_leads fl
            where not fl.is_cancelled
            and (
                (p_start_date is null or fl.closed_date is null or fl.closed_date >= p_start_date)
                and
                (p_end_date is null or fl.created_at < p_end_date + interval '1 day')
            )
            group by fl.account_key, fl.account_name
            order by won_actual desc, active_in_period desc
            limit 5
        ) x
    )

)
into result;

return result;

end;
$$;