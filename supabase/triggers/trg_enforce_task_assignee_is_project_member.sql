create trigger trg_enforce_task_assignee_is_project_member
before insert or update of employee_id, task_id on public.task_assignees
for each row execute function public.enforce_task_assignee_is_project_member();
