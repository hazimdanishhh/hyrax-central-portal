create or replace trigger trg_lifecycle_case_completion
after update of status on public.employee_lifecycle_case_items
for each row
execute function public.check_lifecycle_case_completion();
