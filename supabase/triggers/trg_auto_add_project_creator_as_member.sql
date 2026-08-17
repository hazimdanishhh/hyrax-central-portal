create trigger trg_auto_add_project_creator_as_member
after insert on public.projects
for each row execute function public.auto_add_project_creator_as_member();
