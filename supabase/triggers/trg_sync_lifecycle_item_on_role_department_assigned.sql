-- Coexists with trg_notify_profile_updated on the identical event (AFTER
-- UPDATE ON public.profiles) -- notify_profile_updated.sql's trigger is
-- untouched.
create or replace trigger trg_sync_lifecycle_item_on_role_department_assigned
after update on public.profiles
for each row
execute function public.sync_lifecycle_item_on_role_department_assigned();
