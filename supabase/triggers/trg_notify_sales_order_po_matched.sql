-- Run this once in the Supabase SQL editor, after
-- notify_sales_order_po_matched.sql. Depends on
-- hyrax-data-platform/infrastructure/supabase_sap_migration.sql having
-- already created public.sap_sales_orders (same cross-repo dependency
-- shape as auto_create_sales_rep_mapping.sql on sap_sales_persons).
create or replace trigger trg_notify_sales_order_po_matched
after insert on public.sap_sales_orders
for each row
execute function public.notify_sales_order_po_matched();
