-- arguments: none (trigger function)
-- returns: trigger
--
-- Plugs into the existing, already-shipped event-driven notification
-- system.
--
-- MUST exclude any transition touching 'owner' on either side
-- (old.role='owner' OR new.role='owner') -- transfer_project_ownership()
-- performs exactly two UPDATE ... SET role statements (demote old owner
-- to 'lead', promote new owner to 'owner'), both of which this trigger
-- would otherwise also fire on, double-notifying alongside the direct
-- project.ownership_transferred emit inside that RPC. The ordinary
-- project_members UPDATE policy already forbids touching a row where the
-- old or new role is 'owner' outside that RPC, so this exclusion also
-- means: by construction, this trigger only ever sees member/lead/cc
-- transitions.
--
-- Self-change skip: verified NOT structurally guaranteed --
-- project_members_crud.sql's UPDATE policy (is_elevated_project_member()
-- and role <> 'owner') does not exclude the caller's own row, so a lead
-- CAN self-demote (e.g. to member, or to cc via syncProjectMembers'
-- bulk-edit path). Someone changing their own role already knows.
--
-- SECURITY DEFINER + set search_path = '': resolves the target member's
-- profile_id regardless of the ACTING user's own RLS visibility into
-- employees -- same reasoning block_role_change_to_cc_with_active_tasks.sql
-- gives for the identical hardening.
create or replace function public.notify_project_member_role_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_member_profile_id uuid;
    v_project_name text;
begin
    if old.role is not distinct from new.role then
        return new; -- UPDATE OF role can still fire on a no-op set
    end if;

    if old.role = 'owner' or new.role = 'owner' then
        return new; -- handled exclusively by project.ownership_transferred
    end if;

    if public.current_employee_id() is not distinct from new.employee_id then
        return new; -- self-change -- they already know
    end if;

    select e.profile_id into v_member_profile_id
    from public.employees e where e.id = new.employee_id;

    if v_member_profile_id is null then
        return new;
    end if;

    select p.name into v_project_name from public.projects p where p.id = new.project_id;

    begin
        perform public.emit_notification_event(
            'project.member_role_changed', 'project_members',
            new.project_id::text || ':' || new.employee_id::text,
            jsonb_build_object(
                'project_id', new.project_id,
                'employee_id', new.employee_id,
                'member_profile_id', v_member_profile_id,
                'old_role', old.role,
                'new_role', new.role,
                'changed_by', public.current_employee_id(),
                'title', 'Project Role Changed',
                'message', format('Your role on "%s" changed from %s to %s.', coalesce(v_project_name, 'a project'), old.role, new.role),
                'link_to', '/app/workspace/projects/' || new.project_id
            )
        );
    exception when others then
        raise warning 'project.member_role_changed notification failed for project % employee %: %',
            new.project_id, new.employee_id, sqlerrm;
    end;

    return new;
end;
$$;
