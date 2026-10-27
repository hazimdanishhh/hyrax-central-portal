-- ############################################################################
-- Retire the Sales objects replaced or unused after the 2026-10-27 Sales
-- Leads data spec (DASHBOARD-CONVENTIONS §10c). Run ONLY after the frontend
-- that stops using them is live -- until then live users still call them.
--
--   1. sales_leads_with_closed_date  -- replaced by sales_leads_list, whose
--      closed date and Pending SAP come from sales_lead_facts (the old view
--      defined both a second time, differently, and had no security_invoker)
--   2. get_sales_reports_dashboard   -- the legacy single-page Sales Report
--      (/sales/reports-legacy, removed from the app): its own copies of the
--      closed date and Won, and Won counted cancelled deals (decision D5)
--   3. get_sales_targets_prorated    -- existed only in the live database;
--      nothing calls it (the Targets page reads sales_targets directly)
--
-- Undo: 1 and 2 are in git history (supabase/sql_editor/
-- sales_leads_with_closed_date.sql, get_sales_reports_dashboard_rpc.sql,
-- before 2026-10-27). 3 was never in the repo: if you need it back, save
-- its definition first with
--   select pg_get_functiondef(p.oid) from pg_proc p
--   where p.proname = 'get_sales_targets_prorated';
--
-- WARNING for hyrax-data-platform: infrastructure/
-- clients_sap_customer_link_migration.sql and
-- sales_leads_sap_customer_link_migration.sql recreate the old view. They
-- are one-time migrations, already applied -- do not re-run them.
-- ############################################################################

-- STEP 1 -- run this SELECT on its own first. It lists every live view and
-- function that still uses one of the three; the repo can't see objects that
-- exist only in the live database. It must return NO rows before step 2.
with retiring(name) as (
    values ('sales_leads_with_closed_date'),
           ('get_sales_reports_dashboard'),
           ('get_sales_targets_prorated')
)
select 'view' as kind, c.relname::text as name, r_name.name as uses
from retiring r_name
join pg_depend d
  on d.refobjid = to_regclass('public.' || r_name.name)
  or d.refobjid in (select oid from pg_proc where proname = r_name.name)
join pg_rewrite rw on rw.oid = d.objid
join pg_class c on c.oid = rw.ev_class
where c.relname <> r_name.name
union all
select 'function', p.oid::regprocedure::text, r_name.name
from retiring r_name
join pg_proc p
  on p.pronamespace = 'public'::regnamespace
 and p.proname <> r_name.name
 and p.prosrc ilike '%' || r_name.name || '%';

-- STEP 2 -- no CASCADE anywhere: if a live view still depends on one of
-- these, its drop fails and nothing changes.
drop view if exists public.sales_leads_with_closed_date;

do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as sig
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('get_sales_reports_dashboard', 'get_sales_targets_prorated')
    loop
        execute 'drop function ' || r.sig;
    end loop;
end
$$;
