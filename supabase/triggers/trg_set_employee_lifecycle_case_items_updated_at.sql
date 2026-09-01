create or replace trigger trg_set_employee_lifecycle_case_items_updated_at
before update on public.employee_lifecycle_case_items
for each row
execute function public.set_updated_at();
