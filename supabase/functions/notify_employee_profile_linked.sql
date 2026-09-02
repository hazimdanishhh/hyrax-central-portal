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
-- Second event added 2026-09-02 (UAT readiness follow-up): a new hire had
-- no organic way to discover their own /app/employee/onboarding page --
-- no sidenav entry existed at the time, and the general "welcome" event
-- points at /app/profile instead (from back when the onboarding page was
-- still a stub). profile_linked is itself one of the 12 onboarding
-- checklist items, so this fires almost every time an onboarding-eligible
-- employee gets linked. Gated on an OPEN onboarding case actually existing
-- -- linking a profile to an employee with no case (already completed, or
-- never opened) should stay silent, not send a dead-end link. No
-- employee_can_view check needed, unlike offboarding -- onboarding cases
-- are unconditionally employee-visible from creation (see
-- get_or_create_onboarding_case.sql). Deliberately NOT mirrored for
-- offboarding: that case type has its own intentional employee_can_view
-- gate, flipped explicitly by HR only once the employee has actually been
-- told, since a case can legitimately exist before an involuntary
-- termination is disclosed -- auto-notifying on link would bypass that.
--
-- Plain language plpgsql, no SECURITY DEFINER -- same shape as
-- notify_profile_created.sql/notify_profile_updated.sql. Only the inner
-- emit_notification_event() calls need elevation.
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

        if exists (
            select 1 from public.employee_lifecycle_cases c
            where c.employee_id = new.id and c.case_type = 'ONBOARDING' and c.status = 'OPEN'
        ) then
            begin
                perform public.emit_notification_event(
                    'employee.onboarding_case_ready', 'employees', new.id::text,
                    jsonb_build_object(
                        'new_profile_id', new.profile_id,
                        'employee_name', new.full_name,
                        'title', 'Your Onboarding Has Started',
                        'message', 'Your onboarding checklist is ready to view.',
                        'link_to', '/app/employee/onboarding'
                    )
                );
            exception when others then
                raise warning 'employee.onboarding_case_ready failed for employee %: %', new.id, sqlerrm;
            end;
        end if;
    end if;

    return new;
end;
$$;
