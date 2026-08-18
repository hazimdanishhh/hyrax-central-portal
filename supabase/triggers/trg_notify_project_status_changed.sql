create or replace trigger trg_notify_project_status_changed
after update on public.projects
for each row execute function public.notify_project_status_changed();
