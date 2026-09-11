create trigger trg_notify_task_deleted
before delete on public.tasks
for each row execute function public.notify_task_deleted();
