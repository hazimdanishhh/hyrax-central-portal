-- Run this once in the Supabase SQL editor, after
-- supabase/functions/log_sales_leads_stage_change.sql.
--
-- table: sales_leads
-- function: log_sales_leads_stage_change
-- events: AFTER INSERT, AFTER UPDATE
--
-- This is the actual CREATE TRIGGER statement -- previously this file was
-- just a comment admitting the real trigger was created live in Supabase
-- and never captured here. Written now (2026-08) alongside extending the
-- function itself to also emit a notification event on a real stage
-- change (see log_sales_leads_stage_change.sql and
-- docs/NOTIFICATIONS-ARCHITECTURE.md). Uses `create or replace trigger`
-- so re-running this is safe if the trigger already exists.
create or replace trigger trg_log_sales_lead_stage_change
after insert or update on public.sales_leads
for each row
execute function public.log_sales_leads_stage_change();
