create trigger trg_set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();
