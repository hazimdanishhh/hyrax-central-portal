-- Run once in the Supabase SQL editor, AFTER
-- hyrax-data-platform/infrastructure/employee_sales_rep_mapping_migration.sql
-- (creates the public.employee_sales_rep_mapping table this trigger writes
-- into). See hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.1 for the
-- full employee <-> SAP-rep bridge design.
--
-- Auto-creates a public.employee_sales_rep_mapping row the moment OSLP's
-- sync sees a brand-new SAP sales rep, so no one has to manually insert a
-- row for every new rep. Fires only on genuinely new sales_rep_code values
-- -- OSLP syncs via a plain PostgREST upsert (INSERT ... ON CONFLICT DO
-- UPDATE), and Postgres routes rows that hit the ON CONFLICT arm through
-- the UPDATE trigger path, not INSERT -- so this never re-fires on routine
-- field updates to an existing rep, only once per rep, on first sight.

create or replace function public.fn_auto_create_sales_rep_mapping()
returns trigger
language plpgsql
as
$$
begin
  insert into public.employee_sales_rep_mapping (sales_rep_code)
  values (new.sales_rep_code)
  on conflict (sales_rep_code) do nothing;
  return new;
end;
$$;

create trigger auto_create_sales_rep_mapping
  after insert on public.sap_sales_persons
  for each row execute function public.fn_auto_create_sales_rep_mapping();
