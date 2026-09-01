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
-- brand-new hire.
--
-- No notification is emitted here -- none is designed for
-- onboarding-case-open in docs/NOTIFICATION-RULES-TRACKER.csv; HR already
-- knows, since they're the one who just created the row.
--
-- Plain language plpgsql, no SECURITY DEFINER on this outer function --
-- same shape as notify_profile_created.sql. Only
-- get_or_create_onboarding_case() (called from here) needs elevation to
-- write into employee_lifecycle_cases/_items.
create or replace function public.handle_employee_onboarding_case_open()
returns trigger
language plpgsql
as $$
begin
    if new.employment_status_id = 3
       or new.join_date >= current_date - interval '30 days'
    then
        perform public.get_or_create_onboarding_case(new.id, 'employee_row_inserted');
    end if;

    return new;
end;
$$;
