create trigger trg_set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();
