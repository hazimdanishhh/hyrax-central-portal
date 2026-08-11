-- Exposes closed_date as a real, filterable column for the Sales Leads List
-- page -- previously this value only existed as a per-query derivation
-- inside get_sales_leads_dashboard_rpc.sql's base_leads CTE (via
-- sales_leads_stage_history, falling back to updated_at for legacy rows with
-- no history), so the List page had no way to filter Won/Lost/Cancelled
-- drill-through links by the same date the dashboard KPIs actually use.
--
-- Deliberately duplicates rather than refactors the RPC's own closed_date
-- logic -- kept as a separate, additive object so the already-working RPC
-- doesn't take on a new dependency. Mutations continue writing to the base
-- sales_leads table directly; only List reads switch to this view.
--
-- Note (2026-08): this exact SQL is also inlined into
-- hyrax-data-platform/infrastructure/clients_sap_customer_link_migration.sql,
-- which had to DROP and recreate this view to remove sales_leads.
-- client_contact_id (a `select sl.*` view pins a dependency on every column
-- sl.* expanded to at CREATE time, including columns never named
-- explicitly). If this view's query ever changes, update both copies.
create or replace view public.sales_leads_with_closed_date as
select
    sl.*,
    coalesce(
        cd.closed_date,
        case when sl.stage in ('WON', 'LOST') or sl.is_cancelled then sl.updated_at end
    ) as closed_date
from public.sales_leads sl
left join (
    select lead_id, max(changed_at) as closed_date
    from public.sales_leads_stage_history
    where new_stage in ('WON', 'LOST')
    group by lead_id
) cd on cd.lead_id = sl.id;
