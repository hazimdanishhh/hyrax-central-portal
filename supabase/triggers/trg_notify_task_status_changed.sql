create or replace trigger trg_notify_task_status_changed
after update on public.tasks
for each row execute function public.notify_task_status_changed();
