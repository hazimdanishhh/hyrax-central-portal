-- arguments: none
-- returns: void
--
-- Scheduled-scan companion to check_employee_contract_actions_due.sql --
-- that function only fires a notification and writes nothing else,
-- leaving a real gap: a non-full-time/contract employee whose employment
-- ends via a pre-scheduled end_date got no offboarding checklist case with
-- any real lead time (see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md
-- Part 3 -- confirmed: the only offboarding-trigger branch that could ever
-- catch a pure contract expiration is the direct-to-terminated-category
-- one, which is explicitly designed for zero-lead-time summary
-- terminations, not a pre-known scheduled ending). This scan closes that
-- gap directly.
--
-- Same confirmed-correct exclude-'full-time' condition and 30-day window
-- as check_employee_contract_actions_due.sql -- kept identical on
-- purpose, so the notification and this case-opening scan can never
-- disagree about which employees are in scope.
--
-- Deliberately does NOT touch employment_status_id/resignation_date --
-- end_date being scheduled is itself the signal, independent of any
-- status change (a contract simply running its course is not a
-- "resignation" or "notice" event, and shouldn't be forced through either
-- of those fields). get_or_create_offboarding_case()'s own idempotency
-- (the partial unique index on employee_lifecycle_cases) means this is
-- safe to run daily without ever double-opening a case once one exists,
-- whether opened by this scan, a guided action, or a direct DB edit.
--
-- Own dedup column (contract_offboarding_case_opened_at, separate from
-- contract_action_reminder_sent_at) -- these are independent facts; a case
-- could already exist (opened manually) before this scan ever runs for a
-- given employee.
--
-- Mirrors handle_employee_offboarding_case_open.sql's own
-- notification-emission and onboarding-auto-cancel logic for the
-- was_newly_created=true case, since this scan is a genuine alternative
-- case-open path, not just a reminder -- HR/IT should be notified the
-- same way regardless of which path opened the case.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this system.
create or replace function public.check_employee_contract_offboarding_due()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row record;
    v_case_id uuid;
    v_was_newly_created boolean;
begin
    for v_row in
        select
            e.id, e.full_name, e.end_date,
            m.profile_id as manager_profile_id
        from public.employees e
        left join public.employees m on m.id = e.manager_id
        left join public.employment_status es on es.id = e.employment_status_id
        left join public.employment_type et on et.id = e.employment_type_id
        where es.category = 'active'
          and et.name not ilike 'full-time'
          and e.end_date is not null
          and e.end_date between current_date and current_date + interval '30 days'
          and e.contract_offboarding_case_opened_at is null
    loop
        begin
            select oc.case_id, oc.was_newly_created
            into v_case_id, v_was_newly_created
            from public.get_or_create_offboarding_case(v_row.id, 'contract_end_date_approaching') as oc;

            update public.employees
                set contract_offboarding_case_opened_at = now()
                where id = v_row.id;

            if v_was_newly_created then
                update public.employee_lifecycle_cases
                    set status = 'CANCELLED', closed_at = now(), closed_reason = 'offboarding_case_opened'
                    where employee_id = v_row.id and case_type = 'ONBOARDING' and status = 'OPEN';

                perform public.emit_notification_event(
                    'employee.offboarding_case_opened', 'employees', v_row.id::text,
                    jsonb_build_object(
                        'employee_id', v_row.id, 'employee_name', v_row.full_name,
                        'case_id', v_case_id,
                        'manager_profile_id', v_row.manager_profile_id,
                        'title', 'Offboarding Started',
                        'message', format(
                            '%s''s non-full-time employment ends on %s -- offboarding has started.',
                            v_row.full_name, v_row.end_date
                        ),
                        'link_to', '/app/hr/offboarding/' || v_case_id
                    )
                );

                perform public.emit_notification_event(
                    'employee.offboarding_it_revocation_needed', 'employees', v_row.id::text,
                    jsonb_build_object(
                        'employee_id', v_row.id, 'employee_name', v_row.full_name,
                        'case_id', v_case_id,
                        'title', 'IT Access Revocation Needed',
                        'message', format(
                            '%s''s non-full-time employment ends on %s -- review and revoke IT access by then.',
                            v_row.full_name, v_row.end_date
                        ),
                        'link_to', '/app/it/offboarding/' || v_case_id
                    )
                );
            end if;
        exception when others then
            raise warning 'contract offboarding case-open failed for employee %: %', v_row.id, sqlerrm;
        end;
    end loop;
end;
$$;
