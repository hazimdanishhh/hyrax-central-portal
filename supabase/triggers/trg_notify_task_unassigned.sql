create trigger trg_notify_task_unassigned
after delete on public.task_assignees
for each row execute function public.notify_task_unassigned();
