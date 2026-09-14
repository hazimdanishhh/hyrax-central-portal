create trigger trg_block_project_completion_with_incomplete_tasks
before update of status on public.projects
for each row execute function public.block_project_completion_with_incomplete_tasks();
