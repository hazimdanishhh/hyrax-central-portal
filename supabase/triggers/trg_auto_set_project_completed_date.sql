create or replace trigger trg_auto_set_project_completed_date
before insert or update on public.projects
for each row execute function public.auto_set_project_completed_date();
