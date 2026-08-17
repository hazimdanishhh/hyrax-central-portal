-- arguments: p_name text, p_description text default null,
--            p_start_date date default null, p_target_end_date date default null,
--            p_category_id bigint default null,
--            p_member_employee_ids uuid[] default '{}', p_lead_employee_ids uuid[] default '{}',
--            p_cc_employee_ids uuid[] default '{}'
-- returns: uuid (the new project's id)
--
-- Transactional creation: project row + creator-as-owner membership + any
-- additional initially-chosen leads/members/ccs, all in one call.
-- SECURITY DEFINER, doing its OWN explicit authorization inline rather
-- than relying on RLS -- same shape/justification as this repo's existing
-- link_profile_to_employee.sql (writing rows on behalf of someone other
-- than a flat policy check needs to bypass RLS, so the function must
-- enforce its own authorization instead). Returns just the new id -- the
-- frontend re-fetches the full project via a normal .select(), which will
-- correctly pass projects_crud.sql's SELECT policy since the creator is
-- already a project_members row (role='owner') by the time this returns.
create or replace function public.create_project(
    p_name text,
    p_description text default null,
    p_start_date date default null,
    p_target_end_date date default null,
    p_category_id bigint default null,
    p_member_employee_ids uuid[] default '{}',
    p_lead_employee_ids uuid[] default '{}',
    p_cc_employee_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_creator_employee_id uuid;
    v_project_id uuid;
    v_employee_id uuid;
begin
    select public.current_employee_id() into v_creator_employee_id;

    if v_creator_employee_id is null then
        raise exception
            'Your account is not linked to an employee record yet -- contact a superadmin before creating a project.';
    end if;

    if p_name is null or btrim(p_name) = '' then
        raise exception 'Project name is required.';
    end if;

    -- An employee listed in more than one of the three initial-role
    -- arrays would otherwise silently resolve to "whichever loop happens
    -- to run last" -- reject explicitly instead of guessing.
    if exists (
        select employee_id
        from (
            select unnest(coalesce(p_lead_employee_ids, '{}'::uuid[])) as employee_id
            union all
            select unnest(coalesce(p_member_employee_ids, '{}'::uuid[]))
            union all
            select unnest(coalesce(p_cc_employee_ids, '{}'::uuid[]))
        ) dup
        group by employee_id
        having count(*) > 1
    ) then
        raise exception 'An employee cannot be listed under more than one initial role (lead/member/cc).';
    end if;

    insert into public.projects (name, description, start_date, target_end_date, category_id, created_by)
    values (p_name, p_description, p_start_date, p_target_end_date, p_category_id, v_creator_employee_id)
    returning id into v_project_id;

    -- Deliberately redundant with auto_add_project_creator_as_member()'s
    -- trigger, which just fired as a side effect of the insert above --
    -- ON CONFLICT DO NOTHING makes that harmless.
    insert into public.project_members (project_id, employee_id, role, added_by)
    values (v_project_id, v_creator_employee_id, 'owner', v_creator_employee_id)
    on conflict (project_id, employee_id) do nothing;

    foreach v_employee_id in array coalesce(p_lead_employee_ids, '{}'::uuid[]) loop
        insert into public.project_members (project_id, employee_id, role, added_by)
        values (v_project_id, v_employee_id, 'lead', v_creator_employee_id)
        on conflict (project_id, employee_id) do nothing;
    end loop;

    foreach v_employee_id in array coalesce(p_member_employee_ids, '{}'::uuid[]) loop
        insert into public.project_members (project_id, employee_id, role, added_by)
        values (v_project_id, v_employee_id, 'member', v_creator_employee_id)
        on conflict (project_id, employee_id) do nothing;
    end loop;

    foreach v_employee_id in array coalesce(p_cc_employee_ids, '{}'::uuid[]) loop
        insert into public.project_members (project_id, employee_id, role, added_by)
        values (v_project_id, v_employee_id, 'cc', v_creator_employee_id)
        on conflict (project_id, employee_id) do nothing;
    end loop;

    return v_project_id;
end;
$$;
