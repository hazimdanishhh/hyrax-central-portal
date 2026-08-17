-- arguments: none (trigger function)
-- returns: trigger
--
-- Closes the other half of the onboarding loop: notify_profile_created.sql
-- tells superadmin/HR there's work to do on a new profile; this tells the
-- USER once a superadmin actually does that work (changes department_id
-- and/or role_id via the Users page). Fires on ANY genuine change to
-- either column, not just the first-time "out of General" transition -- a
-- later legitimate department transfer or role promotion should notify the
-- person too, not just initial onboarding.
--
-- Safe against false positives from routine logins: AuthContext.jsx's
-- syncProfile() upsert (which runs on every session load, not just first
-- login) never includes department_id/role_id in its payload at all, so it
-- can never touch these columns -- IS DISTINCT FROM only fires here on an
-- actual edit via the Users page.
--
-- Plain language plpgsql, no SECURITY DEFINER on this outer function --
-- same shape as notify_profile_created.sql/log_sales_leads_stage_change.sql.
-- Only the inner emit_notification_event() call needs elevation.
create or replace function public.notify_profile_updated()
returns trigger
language plpgsql
as $$
declare
    v_department_name text;
    v_role_name text;
begin
    if (old.department_id is distinct from new.department_id)
       or (old.role_id is distinct from new.role_id) then
        select name into v_department_name from public.departments where id = new.department_id;
        select name into v_role_name from public.roles where id = new.role_id;

        begin
            perform public.emit_notification_event(
                'profile.department_role_assigned', 'profiles', new.id::text,
                jsonb_build_object(
                    'profile_id', new.id,
                    'title', 'Your Access Has Been Updated',
                    'message', format(
                        'Your account has been assigned to the %s department as %s. Refresh the app to see your full access.',
                        coalesce(v_department_name, 'Unknown'), coalesce(v_role_name, 'Unknown')
                    ),
                    'link_to', '/app/profile'
                )
            );
        exception when others then
            raise warning 'profile.department_role_assigned failed for profile %: %', new.id, sqlerrm;
        end;
    end if;

    return new;
end;
$$;
