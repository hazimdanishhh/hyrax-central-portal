-- arguments: none (trigger function)
-- returns: trigger
--
-- Blocks hard-deleting a project that still has tasks, unless it's
-- already CANCELLED -- making "cancel first" a real, enforced path, not
-- just a UI convention. Superadmin bypasses.
--
-- SECURITY DEFINER for consistency with the rest of this module's guard
-- functions, though the caller reaching this point (passed
-- projects_crud.sql's owner-only DELETE policy) already has legitimate
-- visibility into this project's own tasks under req #6.
create or replace function public.guard_project_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if public.is_superadmin() then
        return old;
    end if;

    if old.status <> 'CANCELLED' and exists (
        select 1 from public.tasks where project_id = old.id
    ) then
        raise exception
            'Cancel this project (set status to CANCELLED) before deleting it -- it still has tasks. Only a superadmin can bypass this.'
            using errcode = 'check_violation';
    end if;

    return old;
end;
$$;
