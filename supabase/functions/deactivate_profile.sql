-- arguments: p_profile_id uuid
-- returns: void
--
-- Sets profiles.deactivated_at, backing the offboarding checklist's
-- 'portal_account_deactivated' item. Authorized to superadmin OR IT
-- department -- matches the item's actual stated owner ("IT/superadmin")
-- in the checklist config, not superadmin-only the way
-- link_profile_to_employee.sql is (that RPC's narrower role_id = 3 check
-- reflects who can re-point an employee's org-chart link; this one
-- reflects who can act on a departing employee's account, which is
-- explicitly an IT-owned checklist item).
--
-- Does not call any Auth Admin API to actually block login -- left as an
-- implementation-time decision per docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md,
-- not designed further here.
--
-- SECURITY DEFINER because writing another user's profiles row needs to
-- bypass RLS -- but that means this function must enforce its own
-- authorization, since SECURITY DEFINER bypasses RLS entirely. Same
-- explicit-check pattern as link_profile_to_employee.sql/approve_attendance.sql.
create or replace function public.deactivate_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not (public.is_superadmin() or public.is_department('IT')) then
        raise exception 'Not authorized to deactivate profiles';
    end if;

    update public.profiles
        set deactivated_at = now()
        where id = p_profile_id;
end;
$$;
