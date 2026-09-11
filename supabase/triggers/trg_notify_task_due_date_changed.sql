create trigger trg_notify_task_due_date_changed
after update of due_date on public.tasks
for each row execute function public.notify_task_due_date_changed();
