create or replace trigger trg_auto_activate_project_on_task_started
after insert or update on public.tasks
for each row execute function public.auto_activate_project_on_task_started();
