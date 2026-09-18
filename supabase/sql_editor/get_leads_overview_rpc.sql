-- Run this once in the Supabase SQL editor.
--
-- KPI counts/values for the Sales Leads LIST page's OverviewCards (Tier 1,
-- operational) -- deliberately NOT a second copy of
-- get_sales_leads_dashboard_rpc.sql, which backs the sibling Overview tab
-- (Tier 2: win rate, avg deal size, trends, scorecards). A List page must not
-- duplicate its sibling Overview page. Four figures only, all answering
-- "what in my currently-filtered view needs attention right now."
--
-- Plain function (NOT security definer) so it runs with the caller's own
-- row-security context, same reasoning as get_sales_orders_overview.
--
-- Reads public.sales_leads_with_closed_date, NOT public.sales_leads -- that
-- is the exact object fetchLeads() reads, and it is where pending_sap_order
-- and closed_date live. Reading the same object is what guarantees this
-- strip and the list below it can never disagree.
--
-- Filter-aware: every param below mirrors one branch of fetchLeads()'s own
-- filter loop, null-guarded independently. p_closed_date_from/
-- p_closed_date_to are NOT in the page's filterConfig.js -- they arrive via
-- dashboard drill-through URLs and are honoured by fetchLeads(), and
-- usePaginatedQuery forwards every unrecognised searchParam into `filters`,
-- so they must scope this CTE too or a drill-through lands on a strip that
-- contradicts its list.
--
-- Deliberately NOT parameterized: nothing. Unlike the Sales Orders/
-- Fulfillment strips (whose "Only" toggles are set BY their own tiles and so
-- would be circular), every filter here is user-driven, and all four tiles
-- below are computed as FILTER clauses over the same base CTE.
create or replace function public.get_leads_overview(
    p_owner_id              uuid                        default null,
    p_client_id             uuid                        default null,
    p_sap_customer_code     text                        default null,
    p_lead_source_type_id   bigint                      default null,
    p_lose_reason_id        bigint                      default null,
    p_product_type          public.product_type         default null,
    p_stage                 public.sales_leads_stage    default null,
    p_is_on_hold            boolean                     default null,
    p_is_cancelled          boolean                     default null,
    p_pending_sap_order     boolean                     default null,
    p_active_pipeline_only  boolean                     default null,
    p_lost_or_cancelled     boolean                     default null,
    p_closed_only           boolean                     default null,
    p_has_quotation         boolean                     default null,
    p_start_date            date                        default null,
    p_end_date              date                        default null,
    p_closed_date_from      date                        default null,
    p_closed_date_to        date                        default null,
    p_search                text                        default null
)
returns json
language plpgsql
as $$
declare
    result json;
    -- "Aging" cutoff: an open lead untouched-by-progress for 30+ days.
    -- Documented estimate, not an audited target -- tune here, and keep
    -- getLeadsListOverviewConfig's own Date.now() - 30 * 86400000 in
    -- lockstep so the tile's drill-through returns the same rows it counted.
    v_aging_cutoff date := current_date - 30;
begin
    with base_leads as (
        select *
        from public.sales_leads_with_closed_date
        where
            -- Plain equality filters -- one per `map` entry in
            -- leadsService.js.
            (p_owner_id is null            or lead_owner_id       = p_owner_id)
        and (p_client_id is null           or client_id           = p_client_id)
        and (p_sap_customer_code is null   or sap_customer_code   = p_sap_customer_code)
        and (p_lead_source_type_id is null or lead_source_type_id = p_lead_source_type_id)
        and (p_lose_reason_id is null      or lose_reason_id      = p_lose_reason_id)
        and (p_product_type is null        or product_type        = p_product_type)
        and (p_stage is null               or stage               = p_stage)
        and (p_is_on_hold is null          or is_on_hold          = p_is_on_hold)
        and (p_is_cancelled is null        or is_cancelled        = p_is_cancelled)
        and (p_pending_sap_order is null   or pending_sap_order   = p_pending_sap_order)

            -- Composite toggles -- `is not true` (not `is null or`) so both
            -- null AND an explicit false leave the predicate open, exactly
            -- like fetchLeads()'s own `value === "true"` guards.
            --
            -- activePipelineOnly: leadsService.js
        and (p_active_pipeline_only is not true
             or (stage not in ('WON', 'LOST') and is_cancelled = false))
            -- lostOrCancelled: leadsService.js
        and (p_lost_or_cancelled is not true
             or (stage = 'LOST' or is_cancelled))
            -- closedOnly: leadsService.js
        and (p_closed_only is not true
             or stage in ('WON', 'LOST'))
            -- hasQuotation: leadsService.js
        and (p_has_quotation is not true
             or quotation_url is not null)

            -- Date ranges. startDate/endDate scope created_at (this page's
            -- own period filter); closedDateFrom/To scope the view's
            -- computed closed_date. Each bound guarded on its own.
        and (p_start_date is null       or created_at  >= p_start_date)
        and (p_end_date is null         or created_at  <= p_end_date + interval '1 day')
        and (p_closed_date_from is null or closed_date >= p_closed_date_from)
        and (p_closed_date_to is null   or closed_date <= p_closed_date_to + interval '1 day')

            -- Search: title ONLY. fetchLeads() searches exactly one column
            -- -- do not widen this to description/account here, or the
            -- strip counts rows the list won't show.
        and (p_search is null or title ilike '%' || p_search || '%')
    )
    select json_build_object(

        -- 1. ACTIVE PIPELINE (hero, informational). Identical predicate to
        -- get_sales_leads_dashboard_rpc.sql's activeLeads/activePipelineValue
        -- and to fetchLeads()'s activePipelineOnly branch. On-hold leads ARE
        -- included -- that is what the filter this tile links to does.
        'activeCount', count(*) filter (
            where stage not in ('WON', 'LOST') and not is_cancelled
        ),
        'activeValue', coalesce(sum(expected_revenue) filter (
            where stage not in ('WON', 'LOST') and not is_cancelled
        ), 0),

        -- 2. PENDING SAP ORDER (actionable). Uses the view's own
        -- pending_sap_order column rather than restating the EXISTS -- one
        -- definition, three consumers (list filter, badge, this tile).
        -- Value is actual_revenue: this is money already won, waiting to be
        -- keyed into SAP, not a forecast.
        'pendingSapOrderCount', count(*) filter (where pending_sap_order),
        'pendingSapOrderValue', coalesce(
            sum(actual_revenue) filter (where pending_sap_order), 0),

        -- 3. ON HOLD (actionable). Unrestricted, matching fetchLeads()'s bare
        -- .eq("is_on_hold", …) -- deliberately not "and not is_cancelled",
        -- so the tile and its drill-through can't diverge.
        'onHoldCount', count(*) filter (where is_on_hold),
        'onHoldValue', coalesce(
            sum(expected_revenue) filter (where is_on_hold), 0),

        -- 4. AGING PIPELINE (actionable). Open, NOT on hold (so it never
        -- double-counts tile 3), created on or before v_aging_cutoff.
        -- created_at, not updated_at: sales_leads' updated_at trigger is
        -- unverified as actually installed.
        'agingCount', count(*) filter (
            where stage not in ('WON', 'LOST')
              and not is_cancelled
              and not is_on_hold
              and created_at <= v_aging_cutoff + interval '1 day'
        ),
        'agingValue', coalesce(sum(expected_revenue) filter (
            where stage not in ('WON', 'LOST')
              and not is_cancelled
              and not is_on_hold
              and created_at <= v_aging_cutoff + interval '1 day'
        ), 0)
    )
    into result
    from base_leads;

    return result;
end;
$$;
