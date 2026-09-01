-- Coexists with trg_notify_employee_profile_linked on the identical event
-- (AFTER INSERT OR UPDATE ON public.employees) -- Postgres fires multiple
-- triggers per event without conflict; this one only touches
-- employee_lifecycle_case_items, notify_employee_profile_linked.sql's
-- trigger is untouched.
create or replace trigger trg_sync_lifecycle_item_on_profile_linked
after insert or update of profile_id on public.employees
for each row
execute function public.sync_lifecycle_item_on_profile_linked();
