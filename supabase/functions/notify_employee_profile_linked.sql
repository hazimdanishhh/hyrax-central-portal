-- arguments: none (trigger function)
-- returns: trigger
--
-- Closes the other half of the onboarding loop for the employee-link side:
-- notify_profile_created.sql tells HR there's a profile that may need
-- linking; this tells the USER once that link is actually made (via either
-- Employee Management's profile_id field or the Users page's
-- link_profile_to_employee RPC). Covers a fresh link AND a re-link to a
-- different employee -- not unlinking (new.profile_id going to null).
--
-- TG_OP = 'INSERT' handles an employee row created with profile_id already
-- set, where there's no `old` row to compare against.
--
-- Plain language plpgsql, no SECURITY DEFINER -- same shape as
-- notify_profile_created.sql/notify_profile_updated.sql. Only the inner
-- emit_notification_event() call needs elevation.
create or replace function public.notify_employee_profile_linked()
returns trigger
language plpgsql
as $$
begin
    if new.profile_id is not null
       and (TG_OP = 'INSERT' or old.profile_id is distinct from new.profile_id) then
        begin
            perform public.emit_notification_event(
                'employee.profile_linked', 'employees', new.id::text,
                jsonb_build_object(
                    'linked_profile_id', new.profile_id,
                    'employee_name', new.full_name,
                    'title', 'Your Account Has Been Linked',
                    'message', format(
                        'Your portal account has been linked to your employee record (%s).',
                        new.full_name
                    ),
                    'link_to', '/app/profile'
                )
            );
        exception when others then
            raise warning 'employee.profile_linked failed for employee %: %', new.id, sqlerrm;
        end;
    end if;

    return new;
end;
$$;
