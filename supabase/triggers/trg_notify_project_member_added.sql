create trigger trg_notify_project_member_added
after insert on public.project_members
for each row execute function public.notify_project_member_added();
