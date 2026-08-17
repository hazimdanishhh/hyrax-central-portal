create or replace trigger trg_notify_employee_profile_linked
after insert or update on public.employees
for each row
execute function public.notify_employee_profile_linked();
