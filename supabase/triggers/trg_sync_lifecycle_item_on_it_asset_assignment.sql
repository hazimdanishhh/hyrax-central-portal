create or replace trigger trg_sync_lifecycle_item_on_it_asset_assignment
after insert or update of asset_user_id on public.it_assets
for each row
execute function public.sync_lifecycle_item_on_it_asset_assignment();
