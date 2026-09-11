create trigger trg_notify_project_member_role_changed
after update of role on public.project_members
for each row execute function public.notify_project_member_role_changed();
