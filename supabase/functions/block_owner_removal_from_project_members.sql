-- arguments: none (trigger function)
-- returns: trigger
--
-- Req #5: the current owner's row cannot be removed directly -- ownership
-- must be handed off via transfer_project_ownership() first.
--
-- CASCADE GUARD -- critical, easy to miss: project_members.project_id is
-- ON DELETE CASCADE from projects, and BEFORE DELETE ROW triggers fire
-- for cascade-driven deletes exactly as for a direct DELETE. When an
-- owner deletes their own project (unchanged: still owner-only, still
-- allowed), that delete cascades into removing every project_members row
-- for that project -- INCLUDING the owner's own row. Without the guard
-- below, this trigger would unconditionally reject that cascade, making
-- it impossible to ever delete a project at all. The guard checks whether
-- the parent `projects` row is already gone -- Postgres implements ON
-- DELETE CASCADE as an AFTER DELETE trigger on the PARENT that fires once
-- the parent row's own deletion is already applied within the same
-- command, so this reliably distinguishes "whole project being torn
-- down" from "standalone member removal."
--
-- is_superadmin() bypass: an explicit extension for support/data-fix
-- scenarios (e.g. an offboarded owner whose handoff never happened).
create or replace function public.block_owner_removal_from_project_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (select 1 from public.projects where id = old.project_id) then
        return old; -- whole project is being deleted (cascade), not a standalone member removal
    end if;

    if old.role = 'owner' and not public.is_superadmin() then
        raise exception
            'Transfer project ownership before removing the owner. Call transfer_project_ownership() to hand off ownership to another member first.'
            using errcode = 'check_violation';
    end if;

    return old;
end;
$$;
