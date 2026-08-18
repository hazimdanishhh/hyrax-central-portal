create or replace trigger trg_auto_set_task_lifecycle_dates
before insert or update on public.tasks
for each row execute function public.auto_set_task_lifecycle_dates();
