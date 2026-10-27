-- ############################################################################
-- sales_leads_list -- the Sales Leads LIST page's source (fetchLeads,
-- get_leads_overview, the CSV export). Added 2026-10-27, replacing
-- sales_leads_with_closed_date (DASHBOARD-CONVENTIONS §10, the Sales Leads
-- data spec).
--
-- ONE RULE, ONE PLACE. Every column that carries a rule comes from
-- sales_lead_facts -- the same definitions Leads Overview and Sales Reports
-- count with -- so a list filter can never disagree with a figure:
--
--   outcome            'open' | 'won' | 'lost' (cancelled counts as lost, D5)
--   created_on         the created date in Malaysia time
--   closed_on          the date a won/lost lead closed, Malaysia time
--   pending_sap_order  won (not cancelled) and no SAP order carries its PO
--   won_myr            the won revenue (actual_revenue, only when won)
--
-- The old view defined closed_date (a UTC timestamp) and pending_sap_order
-- (cancelled leads included) a second time, differently. Everything else is
-- sales_leads' own columns (sl.*), so PostgREST can still embed the client,
-- SAP customer, owner, source and lose reason, and sort by any column.
--
-- security_invoker: sales_leads' RLS applies, so a staff user sees only
-- their own leads -- in the list exactly as in the cards (the old view had
-- no security_invoker, so it could run with its owner's rights).
--
-- Run order: this file, then get_leads_overview_rpc.sql, then
-- retire_sales_legacy_objects.sql.
-- ############################################################################

create or replace view public.sales_leads_list
with (security_invoker = on) as
select
    sl.*,
    f.outcome,
    f.created_on,
    f.closed_on,
    f.pending_sap_order,
    f.won_myr
from public.sales_leads sl
join public.sales_lead_facts f on f.lead_id = sl.id;

grant select on public.sales_leads_list to authenticated;
revoke all on public.sales_leads_list from anon;
