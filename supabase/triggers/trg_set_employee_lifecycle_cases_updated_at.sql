create or replace trigger trg_set_employee_lifecycle_cases_updated_at
before update on public.employee_lifecycle_cases
for each row
execute function public.set_updated_at();
