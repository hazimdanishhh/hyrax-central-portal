create trigger trg_block_role_change_to_cc_with_active_tasks
before update of role on public.project_members
for each row execute function public.block_role_change_to_cc_with_active_tasks();
