-- arguments: none (trigger function)
-- returns: trigger
--
-- Same event-system integration as notify_task_assigned.sql -- see that
-- file's header comment for the general rationale.
create or replace function public.notify_project_member_added()
returns trigger
language plpgsql
as $$
declare
    v_member_profile_id uuid;
    v_project_name text;
begin
    -- Skip self-added -- covers both a later self-add and the creator's
    -- own bootstrap row (from auto_add_project_creator_as_member() /
    -- create_project()), which would otherwise spuriously notify someone
    -- about a project they just created themselves.
    if new.added_by is not distinct from new.employee_id then
        return new;
    end if;

    select e.profile_id into v_member_profile_id
    from public.employees e where e.id = new.employee_id;

    if v_member_profile_id is null then
        return new;
    end if;

    select p.name into v_project_name from public.projects p where p.id = new.project_id;

    begin
        perform public.emit_notification_event(
            'project.member_added', 'project_members',
            new.project_id::text || ':' || new.employee_id::text,
            jsonb_build_object(
                'project_id', new.project_id,
                'employee_id', new.employee_id,
                'member_profile_id', v_member_profile_id,
                'added_by', new.added_by,
                'title', 'Added to a Project',
                'message', format('You were added to the project "%s".', coalesce(v_project_name, 'a project')),
                'link_to', '/app/workspace/projects/' || new.project_id
            )
        );
    exception when others then
        raise warning 'project.member_added notification failed for project % employee %: %',
            new.project_id, new.employee_id, sqlerrm;
    end;

    return new;
end;
$$;
