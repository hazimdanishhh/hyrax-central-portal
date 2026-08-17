-- arguments: none
-- returns: trigger
--
-- This file previously captured only the trigger BODY with no CREATE
-- FUNCTION wrapper -- a documented gap (see
-- supabase/triggers/set_sales_leads_updated_at.sql's own comment, which
-- admits the real function/trigger code was never captured). This is the
-- complete, idempotent definition -- safe to run even if a function with
-- this exact body is already live under this name (CREATE OR REPLACE),
-- closing the gap for every future table, not just this module's two
-- (projects, tasks).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
