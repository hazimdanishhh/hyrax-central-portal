-- arguments: none (trigger function)
-- returns: trigger
--
-- Symmetric counterpart to notify_project_member_added.sql. Plugs into
-- the existing, already-shipped event-driven notification system.
--
-- CASCADE GUARD, same shape/rationale as
-- block_owner_removal_from_project_members.sql -- project_members.project_id
-- is ON DELETE CASCADE from projects, and this trigger would otherwise
-- fire once per removed member on every project deletion.
--
-- Self-removal skip: "leave a project you're on" is an explicit,
-- self-service action already permitted by project_members_crud.sql's
-- DELETE policy -- someone who removed themselves already knows.
--
-- SECURITY DEFINER + set search_path = '': resolves the removed member's
-- profile_id regardless of the ACTING user's own RLS visibility into
-- employees -- same reasoning block_role_change_to_cc_with_active_tasks.sql
-- gives for the identical hardening. (The already-shipped
-- notify_project_member_added.sql has the same latent gap, fixed
-- separately -- see docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md.)
create or replace function public.notify_project_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_member_profile_id uuid;
    v_project_name text;
begin
    if not exists (select 1 from public.projects where id = old.project_id) then
        return old; -- whole project is being deleted (cascade), not a standalone removal
    end if;

    if public.current_employee_id() is not distinct from old.employee_id then
        return old; -- self-removal ("leave project") -- they already know
    end if;

    select e.profile_id into v_member_profile_id
    from public.employees e where e.id = old.employee_id;

    if v_member_profile_id is null then
        return old;
    end if;

    select p.name into v_project_name from public.projects p where p.id = old.project_id;

    begin
        perform public.emit_notification_event(
            'project.member_removed', 'project_members',
            old.project_id::text || ':' || old.employee_id::text,
            jsonb_build_object(
                'project_id', old.project_id,
                'employee_id', old.employee_id,
                'member_profile_id', v_member_profile_id,
                'removed_by', public.current_employee_id(),
                'title', 'Removed from a Project',
                'message', format('You were removed from the project "%s".', coalesce(v_project_name, 'a project')),
                'link_to', '/app/workspace/projects'
            )
        );
    exception when others then
        raise warning 'project.member_removed notification failed for project % employee %: %',
            old.project_id, old.employee_id, sqlerrm;
    end;

    return old;
end;
$$;
