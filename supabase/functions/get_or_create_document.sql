-- arguments: p_project_id uuid, p_drive_file_id text, p_name text, p_url text,
--            p_mime_type text default null, p_icon_url text default null
-- returns: public.documents (the existing or newly-created row)
--
-- Race-safe get-or-create for "attach a Drive file to this project's
-- document library" -- mirrors get_or_create_project_category.sql's exact
-- shape, targeting documents_unique_file_per_project. Exists specifically
-- so two people concurrently picking the same Drive file into the same
-- project resolve to the SAME documents row instead of a duplicate-key
-- error -- and so a second pick of an already-attached file never
-- touches (attached_by/attached_at or any other column of) the FIRST
-- attacher's row. Supabase JS's .upsert() can't do this: its generated
-- ON CONFLICT DO UPDATE always overwrites every column supplied in the
-- payload, which would corrupt this table's "immutable audit fact"
-- convention (same one projects.created_by/tasks.created_by rely on) on
-- every re-pick of the same file by anyone.
--
-- No SECURITY DEFINER needed -- both the INSERT and the fallback SELECT
-- run as the calling user, so a non-working-member (who'd fail
-- documents_crud.sql's INSERT policy) is correctly rejected outright by
-- the INSERT itself, never silently succeeding via the SELECT fallback.
create or replace function public.get_or_create_document(
    p_project_id uuid,
    p_drive_file_id text,
    p_name text,
    p_url text,
    p_mime_type text default null,
    p_icon_url text default null
)
returns public.documents
language plpgsql
as $$
declare
    v_document public.documents;
begin
    insert into public.documents (project_id, drive_file_id, name, url, mime_type, icon_url, attached_by)
    values (p_project_id, p_drive_file_id, p_name, p_url, p_mime_type, p_icon_url, public.current_employee_id())
    on conflict (project_id, drive_file_id) do nothing
    returning * into v_document;

    if v_document.id is null then
        select * into v_document
        from public.documents
        where project_id = p_project_id and drive_file_id = p_drive_file_id;
    end if;

    return v_document;
end;
$$;
