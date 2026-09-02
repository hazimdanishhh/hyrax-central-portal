-- arguments: none (trigger function)
-- returns: trigger
--
-- AFTER INSERT ON public.employees. Guard: employment_status_id = 3
-- (Probation) OR join_date within the last 30 days -- specifically to
-- avoid spawning an onboarding case for every row when hyrax-data-platform
-- eventually bulk-migrates historical HR data (a real, expected future
-- event per CLAUDE.md's own module-status note). A genuine new hire is
-- virtually always inserted as Probation; a migrated historical row would
-- carry whatever real status it currently holds, essentially never
-- Probation on day one of a migration. The join_date fallback additionally
-- covers a role that skips probation entirely but is still clearly a
-- brand-new hire. This same guard means a future bulk migration naturally
-- won't trigger the notifications below either, without any extra check.
--
-- Emits two notifications on every genuine onboarding case open (added
-- 2026-09-02, UAT readiness pass -- originally shipped silent under the
-- reasoning "HR already knows, they're the one who just created the row",
-- which missed that IT never gets any signal at all, and that a future
-- Data Platform-driven row insert wouldn't have "the HR user who just
-- clicked save" to already know). This is AFTER INSERT, so
-- get_or_create_onboarding_case() is always creating a brand-new case here
-- -- no idempotency/was_newly_created check needed, unlike the offboarding
-- trigger's AFTER UPDATE shape where the same case can be re-targeted by
-- multiple branches.
--
-- Mirrors handle_employee_offboarding_case_open.sql's own
-- case_opened/it_*_needed pair: HR dept + the new hire's manager (if
-- already known at row-creation time -- target_payload_keys gracefully
-- no-ops if manager_id is still null) hear that onboarding has started; IT
-- dept hears separately that account/access setup work is needed,
-- regardless of needs_it_asset -- unlike employee.it_asset_requested
-- (which only covers the three device/access-card items), IT owns 8 of
-- the 12 onboarding items outright (workspace account, portal invite,
-- software access, IT briefing, etc.), none of which previously had any
-- signal to start work.
--
-- Deliberately does NOT duplicate the manager's existing
-- employee.profile_linked notification -- that one already fires once
-- portal access is actually granted, a more meaningful moment for a
-- manager than the internal HR act of creating the row. Kept exactly as
-- designed in docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's "Manager
-- involvement is notification-only for v1" section -- this is a new
-- HR/IT-facing pair, not a change to that decision.
--
-- Plain language plpgsql, no SECURITY DEFINER on this outer function --
-- same shape as notify_profile_created.sql. get_or_create_onboarding_case()/
-- emit_notification_event() (called from here) are what need elevation.
create or replace function public.handle_employee_onboarding_case_open()
returns trigger
language plpgsql
as $$
declare
    v_case_id uuid;
    v_manager_profile_id uuid;
begin
    if new.employment_status_id = 3
       or new.join_date >= current_date - interval '30 days'
    then
        v_case_id := public.get_or_create_onboarding_case(new.id, 'employee_row_inserted');

        select m.profile_id into v_manager_profile_id
        from public.employees m where m.id = new.manager_id;

        begin
            perform public.emit_notification_event(
                'employee.onboarding_case_opened', 'employees', new.id::text,
                jsonb_build_object(
                    'employee_id', new.id, 'employee_name', new.full_name,
                    'case_id', v_case_id,
                    'manager_profile_id', v_manager_profile_id,
                    'title', 'Onboarding Started',
                    'message', format('%s''s onboarding checklist has started.', new.full_name),
                    'link_to', '/app/hr/onboarding/' || v_case_id
                )
            );
        exception when others then
            raise warning 'employee.onboarding_case_opened failed for employee %: %', new.id, sqlerrm;
        end;

        begin
            perform public.emit_notification_event(
                'employee.onboarding_it_setup_needed', 'employees', new.id::text,
                jsonb_build_object(
                    'employee_id', new.id, 'employee_name', new.full_name,
                    'case_id', v_case_id,
                    'title', 'New Hire: IT Setup Needed',
                    'message', format(
                        '%s is onboarding -- set up their accounts and access.',
                        new.full_name
                    ),
                    'link_to', '/app/it/onboarding/' || v_case_id
                )
            );
        exception when others then
            raise warning 'employee.onboarding_it_setup_needed failed for employee %: %', new.id, sqlerrm;
        end;
    end if;

    return new;
end;
$$;
