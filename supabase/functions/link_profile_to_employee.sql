-- arguments: p_profile_id uuid, p_employee_id uuid
-- returns: void
--
-- Manual convenience for superadmin, from the Users page: link a profile
-- to an employee record without having to separately go to Employee
-- Management and find the right row there. Purely sets employees.profile_id
-- -- no department/role side effects at all (department/role assignment for
-- profiles stays a fully manual, separate decision -- see
-- notify_profile_created.sql's own header comment for why).
--
-- p_employee_id is uuid, matching employees.id -- this function previously
-- declared it `bigint`, a real, confirmed bug (not just a stale doc note):
-- employees.id is uuid (verified live via pg_attribute during the
-- Projects & Tasks module build, 2026-08), so the old signature could
-- never match a real row via `where id = p_employee_id`. Compounded by a
-- frontend bug in the same feature (UserEmployeeLink.jsx coerced the
-- picker's uuid value through `Number(...)`, which evaluates to NaN and
-- then serializes to JSON `null`) -- between the two, this RPC has likely
-- never successfully linked a single profile to an employee. Both fixed
-- together, 2026-08.
--
-- SECURITY DEFINER because writing employees.profile_id on behalf of a
-- profile other than the caller's own needs to bypass RLS -- but that
-- means this function must enforce its own authorization, since SECURITY
-- DEFINER bypasses RLS entirely. Same explicit role_id = 3 (superadmin)
-- check as approve_attendance.sql/reject_attendance.sql.
create or replace function public.link_profile_to_employee(
    p_profile_id uuid,
    p_employee_id uuid
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
