create trigger trg_reset_project_deadline_reminder_cooldowns
before update of target_end_date on public.projects
for each row execute function public.reset_project_deadline_reminder_cooldowns();
