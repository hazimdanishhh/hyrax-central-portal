create or replace trigger trg_employee_offboarding_case_open
after update on public.employees
for each row
execute function public.handle_employee_offboarding_case_open();
