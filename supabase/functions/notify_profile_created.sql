-- arguments: none (trigger function)
-- returns: trigger
--
-- Fires once per genuinely-new person, despite profiles rows being created
-- by a client-side upsert() in AuthContext.jsx's syncProfile() (which runs
-- on every login, not just the first, and never sets role_id/department_id
-- -- both default to 1 = staff/General, confirmed via
-- supabase/csv/roles_rows.csv and departments_rows.csv). Postgres only
-- fires INSERT triggers on an upsert's genuine-insert path; every later
-- login for the same id takes the conflict/update path instead, which this
-- trigger (AFTER INSERT only) never sees.
--
-- Plain language plpgsql, no SECURITY DEFINER on this outer function --
-- same shape as log_sales_leads_stage_change.sql. It runs under whatever
-- privileges the inserting session has; only the inner
-- emit_notification_event() calls need elevation to write another user's
-- notifications row, and that function is already SECURITY DEFINER.
--
-- Three separate events, not one event with three recipient groups --
-- fan_out_notification_event() shares one payload's title/message across
-- every recipient of an event_type, but superadmin/HR/the new user each
-- need genuinely different message content. Each call is wrapped in its
-- own exception block so one failing can't block the others.
--
-- Deliberately NOT auto-syncing department_id from any employees record --
-- employees.department_id isn't reliably accurate for every employee yet
-- (same class of problem as employee.confirmation_status_mismatch's
-- migration-data gap), so department/role assignment for profiles stays a
-- fully manual superadmin decision.
create or replace function public.notify_profile_created()
returns trigger
language plpgsql
as $$
begin
    if new.department_id = 1 then -- still "General" -- id 1, confirmed via departments_rows.csv
        begin
            perform public.emit_notification_event(
                'profile.created.needs_department_assignment', 'profiles', new.id::text,
                jsonb_build_object(
                    'profile_id', new.id, 'full_name', new.full_name, 'email', new.email,
                    'title', 'New User Needs a Real Department',
                    'message', format(
                        '%s (%s) signed in for the first time and is still in the default General department -- assign their real department (and role, if they should be a manager) in Users.',
                        new.full_name, new.email
                    ),
                    'link_to', '/app/system/users'
                )
            );
        exception when others then
            raise warning 'profile.created.needs_department_assignment failed for profile %: %', new.id, sqlerrm;
        end;
    end if;

    begin
        perform public.emit_notification_event(
            'profile.created.needs_employee_link', 'profiles', new.id::text,
            jsonb_build_object(
                'profile_id', new.id, 'full_name', new.full_name, 'email', new.email,
                'title', 'New User May Need Linking to an Employee Record',
                'message', format(
                    '%s (%s) signed in for the first time. If they have an employee record, link it via the Profile field on Employee Management (or the Users page).',
                    new.full_name, new.email
                ),
                'link_to', '/app/hr/employees/list'
            )
        );
    exception when others then
        raise warning 'profile.created.needs_employee_link failed for profile %: %', new.id, sqlerrm;
    end;

    begin
        perform public.emit_notification_event(
            'profile.created.welcome', 'profiles', new.id::text,
            jsonb_build_object(
                'new_profile_id', new.id,
                'title', 'Welcome to Hyrax Central Portal',
                'message', 'Welcome aboard! Your account has been created. Right now you have bare-minimum access (staff role, General department) -- our system admin has been notified and will assign you to your real department and role shortly. Check back here once that happens to see your full access.',
                'link_to', '/app/profile'
            )
        );
    exception when others then
        raise warning 'profile.created.welcome failed for profile %: %', new.id, sqlerrm;
    end;

    return new;
end;
$$;
