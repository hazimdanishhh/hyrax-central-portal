-- arguments: none (trigger function)
-- returns: trigger
--
-- AFTER UPDATE ON public.employees. Three conditions, any one of which
-- opens an offboarding case -- deliberately overlapping, each covering a
-- real separation path:
--   1. resignation_date newly set -- the normal voluntary-resignation
--      path, and the earliest possible signal regardless of whether status
--      also changes in the same edit. Gives IT/HR the most lead time.
--   2. employment_status_id transitions to 13 (Terminated Notice) -- an
--      involuntary-but-with-notice separation where HR moves status
--      straight to Notice without necessarily setting resignation_date (a
--      field name that implies voluntary resignation).
--   3. employment_status_id transitions directly to any category =
--      'terminated' value -- covers a summary/immediate termination with
--      no notice period at all, firing the instant status finalizes with
--      no dependency on ever passing through Notice first.
--
-- get_or_create_offboarding_case() is idempotent, so branches firing
-- together on the same UPDATE (HR commonly sets resignation_date and
-- status=13 in one edit) never double-open a case -- was_newly_created
-- tells this trigger whether to actually emit notifications and run the
-- onboarding-auto-cancel companion below, versus a no-op re-fire against
-- an already-open case.
--
-- Simultaneous cases: the moment a case is genuinely newly opened, any
-- still-OPEN onboarding case for the same employee is auto-cancelled
-- (closed_reason = 'offboarding_case_opened') -- confirmed real via actual
-- employee data in the sibling hyrax-data-platform repo (one of three
-- recorded departures happened ~39 days after joining, still inside the
-- 30-day onboarding guard window), not a hypothetical edge case. CANCELLED,
-- not deleted or force-completed -- the onboarding work genuinely didn't
-- finish, and the case history should say so honestly.
--
-- Retracted resignation: if there's a currently OPEN offboarding case and
-- resignation_date is cleared back to null while status returns to an
-- 'active' category, auto-cancel it (closed_reason = 'resignation_retracted')
-- -- the offboarding mirror of Section A's own "closing the loop"
-- philosophy, so nobody has to remember to manually cancel a stale case.
--
-- Plain language plpgsql, no SECURITY DEFINER on this outer function.
-- get_or_create_offboarding_case()/get_or_create_onboarding_case()/
-- emit_notification_event() (called from here) are what need elevation.
create or replace function public.handle_employee_offboarding_case_open()
returns trigger
language plpgsql
as $$
declare
    v_opens boolean := false;
    v_opened_reason text;
    v_case_id uuid;
    v_was_newly_created boolean;
    v_manager_profile_id uuid;
begin
    if new.resignation_date is not null and old.resignation_date is distinct from new.resignation_date then
        v_opens := true;
        v_opened_reason := 'resignation_date_set';
    elsif new.employment_status_id = 13 and old.employment_status_id is distinct from 13 then
        v_opens := true;
        v_opened_reason := 'status_terminated_notice';
    elsif exists (
              select 1 from public.employment_status es
              where es.id = new.employment_status_id and es.category = 'terminated'
          )
          and old.employment_status_id is distinct from new.employment_status_id then
        v_opens := true;
        v_opened_reason := 'status_terminal_direct';
    end if;

    if v_opens then
        select oc.case_id, oc.was_newly_created
        into v_case_id, v_was_newly_created
        from public.get_or_create_offboarding_case(new.id, v_opened_reason) as oc;

        if v_was_newly_created then
            -- Auto-cancel a still-open onboarding case for this same employee.
            update public.employee_lifecycle_cases
                set status = 'CANCELLED', closed_at = now(), closed_reason = 'offboarding_case_opened'
                where employee_id = new.id and case_type = 'ONBOARDING' and status = 'OPEN';

            select m.profile_id into v_manager_profile_id
            from public.employees m where m.id = new.manager_id;

            begin
                perform public.emit_notification_event(
                    'employee.offboarding_case_opened', 'employees', new.id::text,
                    jsonb_build_object(
                        'employee_id', new.id, 'employee_name', new.full_name,
                        'case_id', v_case_id,
                        'manager_profile_id', v_manager_profile_id,
                        'title', 'Offboarding Started',
                        'message', format('%s''s offboarding has started.', new.full_name),
                        'link_to', '/app/hr/offboarding/' || v_case_id
                    )
                );
            exception when others then
                raise warning 'employee.offboarding_case_opened failed for employee %: %', new.id, sqlerrm;
            end;

            begin
                perform public.emit_notification_event(
                    'employee.offboarding_it_revocation_needed', 'employees', new.id::text,
                    jsonb_build_object(
                        'employee_id', new.id, 'employee_name', new.full_name,
                        'case_id', v_case_id,
                        'title', 'IT Access Revocation Needed',
                        'message', format(
                            '%s is offboarding -- review and revoke IT access by their last working day.',
                            new.full_name
                        ),
                        'link_to', '/app/it/offboarding/' || v_case_id
                    )
                );
            exception when others then
                raise warning 'employee.offboarding_it_revocation_needed failed for employee %: %', new.id, sqlerrm;
            end;
        end if;
    end if;

    if new.resignation_date is null and old.resignation_date is not null
       and exists (
           select 1 from public.employment_status es
           where es.id = new.employment_status_id and es.category = 'active'
       )
    then
        update public.employee_lifecycle_cases
            set status = 'CANCELLED', closed_at = now(), closed_reason = 'resignation_retracted'
            where employee_id = new.id and case_type = 'OFFBOARDING' and status = 'OPEN';
    end if;

    return new;
end;
$$;
