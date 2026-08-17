-- arguments: p_project_id uuid, p_new_owner_employee_id uuid
-- returns: void
--
-- Req #5/#6. The ONLY path allowed to move the 'owner' tag --
-- project_members_crud.sql's UPDATE policy explicitly forbids any
-- ordinary UPDATE from touching a row where the old or new role is
-- 'owner', specifically to force every ownership change through here,
-- where it can be validated and made atomic in one place.
--
-- MUST be SECURITY DEFINER, not "fine under normal RLS": the generic
-- project_members UPDATE policy categorically blocks anything touching
-- 'owner' by design, so a SECURITY INVOKER version of this function would
-- be blocked by its own table's RLS from doing its job at all. This
-- mirrors the existing precedent in this repo (link_profile_to_employee.sql,
-- approve_attendance.sql): SECURITY DEFINER to bypass RLS, with
-- authorization re-implemented by hand inside the function body instead.
--
-- ## Why this is 2 sequential UPDATEs, not 1 UPDATE...CASE
-- A non-deferrable unique index (and a partial index can never be
-- DEFERRABLE) is checked immediately, per row, in whatever order the
-- executor happens to visit the rows being updated -- NOT batched at the
-- end of the statement. A single UPDATE touching both the old and new
-- owner's rows via a CASE expression risks the executor visiting the NEW
-- owner's row first (setting it to 'owner' while the OLD owner's row is
-- still 'owner' at that instant) and raising "duplicate key value
-- violates unique constraint" -- non-deterministically, depending on UUID
-- sort order, i.e. this could pass in testing and fail in production for
-- a different pair of employee_ids. This is the same documented Postgres
-- gotcha as "swapping two unique column values in one UPDATE fails
-- without a deferrable constraint." Two separate statements in a FIXED
-- order (demote old owner first, promote new owner second) sidesteps the
-- ordering hazard completely and deterministically, while staying fully
-- atomic from the caller's point of view -- both statements run inside
-- this one function call's single implicit transaction, so if the second
-- one ever failed, the first would roll back with it. `for update` below
-- additionally serializes two concurrent transfer attempts on the same
-- project against each other.
create or replace function public.transfer_project_ownership(
    p_project_id uuid,
    p_new_owner_employee_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_caller_id uuid := public.current_employee_id();
    v_current_owner_id uuid;
begin
    if v_caller_id is null then
        raise exception 'Not authorized: no linked employee record for the current user';
    end if;

    select pm.employee_id into v_current_owner_id
    from public.project_members pm
    where pm.project_id = p_project_id and pm.role = 'owner'
    for update;

    if v_current_owner_id is null then
        raise exception 'Project % has no current owner -- data integrity issue, contact a superadmin', p_project_id;
    end if;

    if v_caller_id <> v_current_owner_id and not public.is_superadmin() then
        raise exception 'Only the current project owner can transfer ownership';
    end if;

    if p_new_owner_employee_id = v_current_owner_id then
        raise exception 'Employee % is already the project owner', p_new_owner_employee_id;
    end if;

    if not exists (
        select 1 from public.project_members
        where project_id = p_project_id and employee_id = p_new_owner_employee_id
    ) then
        raise exception 'Employee % must already be a project member before being made owner', p_new_owner_employee_id;
    end if;

    if exists (
        select 1 from public.project_members
        where project_id = p_project_id and employee_id = p_new_owner_employee_id and role = 'cc'
    ) then
        raise exception 'A CC cannot be made project owner -- change their role to lead or member first';
    end if;

    -- Demote first, promote second -- fixed order, see header comment above.
    update public.project_members
        set role = 'lead'
        where project_id = p_project_id and employee_id = v_current_owner_id;

    update public.project_members
        set role = 'owner'
        where project_id = p_project_id and employee_id = p_new_owner_employee_id;

    -- Belt-and-braces confirmation, cheap enough to always run.
    if (select count(*) from public.project_members where project_id = p_project_id and role = 'owner') <> 1 then
        raise exception 'Ownership transfer for project % did not result in exactly one owner -- rolled back', p_project_id;
    end if;
end;
$$;
