-- arguments: p_profile_id uuid, p_employee_id bigint
-- returns: void
--
-- Manual convenience for superadmin, from the Users page: link a profile
-- to an employee record without having to separately go to Employee
-- Management and find the right row there. Purely sets employees.profile_id
-- -- no department/role side effects at all (department/role assignment for
-- profiles stays a fully manual, separate decision -- see
-- notify_profile_created.sql's own header comment for why).
--
-- SECURITY DEFINER because writing employees.profile_id on behalf of a
-- profile other than the caller's own needs to bypass RLS -- but that
-- means this function must enforce its own authorization, since SECURITY
-- DEFINER bypasses RLS entirely. Same explicit role_id = 3 (superadmin)
-- check as approve_attendance.sql/reject_attendance.sql.
create or replace function public.link_profile_to_employee(
    p_profile_id uuid,
    p_employee_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_id = 3
    ) then
        raise exception 'Not authorized to link profiles to employees';
    end if;

    -- A profile should only ever be linked to one employee at a time --
    -- clear any employee row currently linked to this profile first.
    update public.employees
        set profile_id = null
        where profile_id = p_profile_id;

    update public.employees
        set profile_id = p_profile_id
        where id = p_employee_id;
end;
$$;
