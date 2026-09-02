-- Run once in the Supabase SQL editor. Adds the "Access Card" subcategory
-- under the existing "Security" it_asset_category row -- backs the
-- offboarding checklist's `it_assets_returned` derived item (see
-- docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md), which needs a real
-- category to assign an access-card asset under so it's covered by the
-- same it_assets.asset_user_id-based return check as any other device.
--
-- Resolves the category by name via subquery, not a hardcoded id -- both
-- category and subcategory tables are managed live in Supabase (no seed
-- CSV exists in this repo for either), so a literal id would be a guess.
-- Guarded by NOT EXISTS rather than ON CONFLICT, since no unique
-- constraint on (category_id, name) is known to exist on this table --
-- safe to re-run either way.
insert into public.it_asset_subcategory (category_id, name)
select c.id, 'Access Card'
from public.it_asset_category c
where c.name = 'Security'
  and not exists (
      select 1 from public.it_asset_subcategory s
      where s.category_id = c.id and s.name = 'Access Card'
  );
