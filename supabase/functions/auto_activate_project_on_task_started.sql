-- arguments: none (trigger function)
-- returns: trigger
--
-- Closes a real automation gap: projects.status was previously "manual-only
-- in every direction" (see docs/PROJECTS-TASKS-ARCHITECTURE.md's schema
-- table) -- true for the completion side (a project can be fully
-- task-complete and still waiting on sign-off, deliberately not
-- auto-flipped), but the start side had no automation at all. This closes
-- just that one gap: a project sitting in PLANNING while a task has
-- clearly started should read as ACTIVE.
--
-- Handles both INSERT and UPDATE with one TG_OP check -- same shape as
-- log_sales_leads_stage_change.sql -- because taskTableConfig.jsx makes
-- `status` editable on the Add Task form itself, so a task can reach
-- IN_PROGRESS directly on creation, not only via a later UPDATE.
--
-- Deliberately narrow: only PLANNING -> ACTIVE. A project already ON_HOLD,
-- COMPLETED, or CANCELLED is a state a human chose on purpose and is left
-- alone here -- silently reactivating a completed project because an old
-- task got bulk-edited would be a footgun, not a helpful automation. No
-- reverse rule either (a task leaving IN_PROGRESS does not revert the
-- project to PLANNING) -- one direction only, matching what was asked.
--
-- No SECURITY DEFINER -- the caller already has UPDATE rights on projects
-- via existing RLS (a project's own working member is the one starting a
-- task). The update below also fires trg_notify_project_status_changed
-- (AFTER UPDATE ON projects) for free -- no separate notification wiring
-- needed for this automation.
create or replace function public.auto_activate_project_on_task_started()
returns trigger
language plpgsql
as $$
declare
    v_project_status public.project_status;
begin
    if new.status is distinct from 'IN_PROGRESS' then
        return new;
    end if;

    if TG_OP = 'UPDATE' and old.status is not distinct from new.status then
        return new;
    end if;

    select status into v_project_status from public.projects where id = new.project_id;

    if v_project_status = 'PLANNING' then
        update public.projects set status = 'ACTIVE' where id = new.project_id;
    end if;

    return new;
end;
$$;
