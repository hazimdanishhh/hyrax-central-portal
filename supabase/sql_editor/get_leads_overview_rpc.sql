-- ############################################################################
-- get_leads_overview -- the Sales Leads LIST page's KPI cards
-- (src/pages/user/sales/leads/list/constants/overviewConfig.js). Rebuilt
-- 2026-10-27 to DASHBOARD-CONVENTIONS §2a.
--
-- THE RULE: each card's number is exactly what clicking it shows.
--   * The cards follow the list's PERIOD (created date), PANEL FILTERS and
--     SEARCH -- the same rows fetchLeads() returns -- so the cards never
--     contradict the list under them.
--   * They do NOT follow the status tab: each card IS one of the tabs
--     (Active, Pending SAP, On Hold, Aging), so this function has no tab
--     parameters (it used to take them, so a card read 0 the moment you
--     were on another tab).
--   * The MEASURES are the shared metric layer's (sales_lead_facts), so with
--     no filters these equal Leads Overview's / Sales Reports' Today figures:
--       active   outcome = 'open' (on-hold leads included)
--       pending  pending_sap_order -- won and NOT cancelled (decision D5);
--                the old version counted cancelled won leads
--       on hold  open AND on hold; the old version counted won, lost and
--                cancelled leads on hold too
--       aging    open, not on hold, created_on <= current_date - 30 (the
--                Malaysia-time created date)
--   * ONE SOURCE (2026-10-27): the rows AND the measures come from
--     sales_leads_list, the view fetchLeads reads -- its rule columns
--     (outcome, created_on, closed_on, pending_sap_order) are
--     sales_lead_facts' own. So a filter here is applied exactly as in the
--     list, and the closed window compares closed_on (Malaysia dates), the
--     same days Leads Overview and Reports count by.
--   * agingCutoff is returned so the Aging card's link uses the SAME
--     cutoff the count used (the browser's "today" can differ from the
--     database's for hours).
--
-- Security invoker: sales_leads' RLS keeps a staff user to their own leads,
-- exactly like the list.
-- ############################################################################

-- The old signature (19 params incl. the tab filters) must go, or the two
-- versions would make every call ambiguous. Drop every version by name,
-- whatever its argument types are in the live database.
do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as sig
        from pg_proc p
        where p.proname = 'get_leads_overview'
          and p.pronamespace = 'public'::regnamespace
    loop
        execute 'drop function ' || r.sig;
    end loop;
end
$$;

create or replace function public.get_leads_overview(
    p_owner_id            uuid    default null,
    p_client_id           uuid    default null,
    p_sap_customer_code   text    default null,
    p_lead_source_type_id bigint  default null,
    p_lose_reason_id      bigint  default null,
    p_product_type        text    default null,
    p_has_quotation       boolean default null,
    p_start_date          date    default null,
    p_end_date            date    default null,
    p_closed_date_from    date    default null,
    p_closed_date_to      date    default null,
    p_search              text    default null
)
returns json
language sql
stable
security invoker
as $$
    with rows as (
        select l.outcome, l.is_on_hold, l.created_on, l.pending_sap_order,
               l.expected_revenue as expected_myr, l.close_probability,
               l.won_myr
        from public.sales_leads_list l
        where (p_owner_id is null            or l.lead_owner_id       = p_owner_id)
          and (p_client_id is null           or l.client_id           = p_client_id)
          and (p_sap_customer_code is null   or l.sap_customer_code   = p_sap_customer_code)
          and (p_lead_source_type_id is null or l.lead_source_type_id = p_lead_source_type_id)
          and (p_lose_reason_id is null      or l.lose_reason_id      = p_lose_reason_id)
          and (p_product_type is null        or l.product_type::text  = p_product_type)
          and (p_has_quotation is not true   or l.quotation_url is not null)
          -- the period: the lead's created date, Malaysia time
          and (p_start_date is null or l.created_on >= p_start_date)
          and (p_end_date is null   or l.created_on <= p_end_date)
          -- closed window (Leads Overview / Reports drill-through links):
          -- whole Malaysia days, as fetchLeads and the reports
          and (p_closed_date_from is null or l.closed_on >= p_closed_date_from)
          and (p_closed_date_to is null   or l.closed_on <= p_closed_date_to)
          -- search: title only, as fetchLeads
          and (p_search is null or l.title ilike '%' || p_search || '%')
    )
    select json_build_object(
        'activeCount', count(*) filter (where outcome = 'open'),
        'activeValue', coalesce(sum(expected_myr) filter (where outcome = 'open'), 0),
        'weightedValue', coalesce(sum(expected_myr * coalesce(close_probability, 0) / 100.0)
                                  filter (where outcome = 'open'), 0),
        'pendingSapOrderCount', count(*) filter (where pending_sap_order),
        'pendingSapOrderValue', coalesce(sum(won_myr) filter (where pending_sap_order), 0),
        'onHoldCount', count(*) filter (where outcome = 'open' and is_on_hold),
        'onHoldValue', coalesce(sum(expected_myr) filter (where outcome = 'open' and is_on_hold), 0),
        'agingCount', count(*) filter (
            where outcome = 'open' and not coalesce(is_on_hold, false)
              and created_on <= current_date - 30),
        'agingValue', coalesce(sum(expected_myr) filter (
            where outcome = 'open' and not coalesce(is_on_hold, false)
              and created_on <= current_date - 30), 0),
        'agingCutoff', current_date - 30
    )
    from rows
$$;

revoke execute on function public.get_leads_overview(
    uuid, uuid, text, bigint, bigint, text, boolean, date, date, date, date, text) from public, anon;
grant execute on function public.get_leads_overview(
    uuid, uuid, text, bigint, bigint, text, boolean, date, date, date, date, text) to authenticated;
