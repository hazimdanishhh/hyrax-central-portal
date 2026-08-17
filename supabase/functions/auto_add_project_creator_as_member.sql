-- arguments: none (trigger function)
-- returns: trigger
--
-- Fires on every INSERT into projects, regardless of path -- guarantees
-- "creator is always the project's owner" holds as a DATABASE invariant,
-- not something every future insert path must remember. SECURITY
-- DEFINER: bypasses project_members_crud.sql's elevated-only INSERT
-- policy, which the very first member of a brand-new project can never
-- satisfy (nobody is an elevated member yet, including the creator) --
-- same bootstrapping shape as profiles/is_superadmin(). ON CONFLICT DO
-- NOTHING: harmless to run twice -- create_project() also explicitly
-- inserts this same row; the overlap is deliberate belt-and-suspenders,
-- not a bug.
create or replace function public.auto_add_project_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.project_members (project_id, employee_id, role, added_by)
    values (new.id, new.created_by, 'owner', new.created_by)
    on conflict (project_id, employee_id) do nothing;

    return new;
end;
$$;
