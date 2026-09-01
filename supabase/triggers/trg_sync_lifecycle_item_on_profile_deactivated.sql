create or replace trigger trg_sync_lifecycle_item_on_profile_deactivated
after update of deactivated_at on public.profiles
for each row
execute function public.sync_lifecycle_item_on_profile_deactivated();
