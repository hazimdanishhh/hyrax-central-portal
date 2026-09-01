create or replace trigger trg_employee_onboarding_case_open
after insert on public.employees
for each row
execute function public.handle_employee_onboarding_case_open();
