-- arguments: p_name text
-- returns: bigint (the category's id, existing or newly created)
--
-- The on-the-fly category creation the product owner asked for, mirroring
-- Sales' existing "create new prospect inline" idea (LeadAccountEditor.jsx)
-- but simpler -- a category needs only a name, no required side-fields.
-- Race-safe: two people typing the same brand-new name around the same
-- time resolve to the same row via ON CONFLICT against the case-
-- insensitive unique index, not a duplicate-key error.
--
-- No SECURITY DEFINER needed -- project_categories INSERT is already open
-- to all authenticated users (see project_categories_crud.sql), so no
-- privilege bypass is required here.
create or replace function public.get_or_create_project_category(p_name text)
returns bigint
language plpgsql
as $$
declare
    v_id bigint;
    v_clean_name text := btrim(p_name);
begin
    if v_clean_name = '' then
        raise exception 'Category name cannot be blank.';
    end if;

    insert into public.project_categories (name, created_by)
    values (v_clean_name, public.current_employee_id())
    on conflict ((lower(btrim(name)))) do nothing
    returning id into v_id;

    if v_id is null then
        select id into v_id from public.project_categories where lower(btrim(name)) = lower(v_clean_name);
    end if;

    return v_id;
end;
$$;
