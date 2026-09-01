-- arguments: none (trigger function)
-- returns: trigger
--
-- Marks the 'portal_account_deactivated' item DONE the moment
-- profiles.deactivated_at is set (via the new deactivate_profile() RPC) --
-- the derived-item counterpart to Section A's employee.profile_linked, one
-- lifecycle stage later.
--
-- SECURITY DEFINER: writes into employee_lifecycle_case_items on behalf of
-- whichever IT/superadmin session called deactivate_profile(), whose RLS
-- standing was earned on profiles, not on the checklist tables.
create or replace function public.sync_lifecycle_item_on_profile_deactivated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.deactivated_at is not null and old.deactivated_at is distinct from new.deactivated_at then
        update public.employee_lifecycle_case_items
        set status = 'DONE', completed_at = now(), completed_by = null
        where item_key = 'portal_account_deactivated'
          and status <> 'DONE'
          and case_id in (
              select c.id
              from public.employee_lifecycle_cases c
              join public.employees e on e.id = c.employee_id
              where e.profile_id = new.id and c.case_type = 'OFFBOARDING' and c.status = 'OPEN'
          );
    end if;

    return new;
end;
$$;
