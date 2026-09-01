-- arguments: none (trigger function)
-- returns: trigger
--
-- Genuinely new trigger on it_assets -- Section B never needed one, since
-- its "still pending" KPI was purely query-time (needs_it_asset = true and
-- not exists (...)). This module needs a real row to sync, so it adds the
-- first trigger on it_assets.asset_user_id changes.
--
-- Two directions, in one function:
--   - asset_user_id newly set (assignment): mark that employee's OPEN
--     onboarding case's 'it_asset_assigned' item DONE -- the literal
--     Section B resolution query, reused verbatim as a derived-item sync.
--   - asset_user_id cleared or reassigned away from an employee
--     (unassignment/reassignment): re-check that FORMER employee's OPEN
--     offboarding case's 'it_assets_returned' item -- mark DONE only if no
--     OTHER it_assets row still points at them (an employee can have
--     multiple assets; all must be returned before the item completes).
--
-- SECURITY DEFINER: writes into employee_lifecycle_case_items on behalf of
-- whichever IT staffer edited IT Asset Management, whose RLS standing was
-- earned on it_assets, not on the checklist tables.
create or replace function public.sync_lifecycle_item_on_it_asset_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.asset_user_id is not null
       and (TG_OP = 'INSERT' or old.asset_user_id is distinct from new.asset_user_id) then
        update public.employee_lifecycle_case_items
        set status = 'DONE', completed_at = now(), completed_by = null
        where item_key = 'it_asset_assigned'
          and status <> 'DONE'
          and case_id in (
              select id from public.employee_lifecycle_cases
              where employee_id = new.asset_user_id and case_type = 'ONBOARDING' and status = 'OPEN'
          );
    end if;

    if TG_OP = 'UPDATE'
       and old.asset_user_id is not null
       and old.asset_user_id is distinct from new.asset_user_id
       and not exists (
           select 1 from public.it_assets
           where asset_user_id = old.asset_user_id and id <> old.id
       ) then
        update public.employee_lifecycle_case_items
        set status = 'DONE', completed_at = now(), completed_by = null
        where item_key = 'it_assets_returned'
          and status = 'PENDING' -- never resurrect a SKIPPED row (no assets were assigned at case-open)
          and case_id in (
              select id from public.employee_lifecycle_cases
              where employee_id = old.asset_user_id and case_type = 'OFFBOARDING' and status = 'OPEN'
          );
    end if;

    return new;
end;
$$;
