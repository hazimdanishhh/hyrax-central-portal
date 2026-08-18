-- arguments: none (trigger function)
-- returns: trigger
--
-- Mirrors auto_set_task_lifecycle_dates()'s completed_date half exactly,
-- applied to projects. Unlike tasks, project status is NOT locked to a
-- guarded button flow -- it's still freely editable via the ordinary Edit
-- Project form's status dropdown, on top of the existing guarded "Mark as
-- Completed" button (ProjectDetailLayout.jsx). Neither path is
-- special-cased here -- this reacts to the resulting `status` value
-- itself, regardless of which UI path produced it, so it can't be
-- bypassed by a future third path either.
create or replace function public.auto_set_project_completed_date()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'COMPLETED'
       and (TG_OP = 'INSERT' or old.status is distinct from new.status) then
        new.completed_date := current_date;
    elsif new.status is distinct from 'COMPLETED' then
        new.completed_date := null;
    end if;

    return new;
end;
$$;
