-- arguments: none (trigger function)
-- returns: trigger
--
-- Sibling trigger alongside notify_profile_updated.sql's own AFTER UPDATE
-- ON public.profiles trigger, same IS DISTINCT FROM condition -- marks the
-- 'role_department_assigned' item DONE the moment
-- profiles.role_id/department_id actually changes away from the 1/1
-- staff/General default, the exact fact profile.department_role_assigned
-- already watches.
--
-- SECURITY DEFINER: writes into employee_lifecycle_case_items on behalf of
-- whichever superadmin session edited the Users page, whose RLS standing
-- was earned on profiles, not on the checklist tables.
create or replace function public.sync_lifecycle_item_on_role_department_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (old.department_id is distinct from new.department_id)
       or (old.role_id is distinct from new.role_id) then
        update public.employee_lifecycle_case_items
        set status = 'DONE', completed_at = now(), completed_by = null
        where item_key = 'role_department_assigned'
          and status <> 'DONE'
          and case_id in (
              select c.id
              from public.employee_lifecycle_cases c
              join public.employees e on e.id = c.employee_id
              where e.profile_id = new.id and c.case_type = 'ONBOARDING' and c.status = 'OPEN'
          );
    end if;

    return new;
end;
$$;
