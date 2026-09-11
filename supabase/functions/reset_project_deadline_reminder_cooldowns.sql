-- arguments: none (trigger function)
-- returns: trigger
--
-- Silent bookkeeping, not a notification -- when a project's
-- target_end_date is rescheduled, the old deadline_reminder_sent_at/
-- overdue_last_notified_at facts no longer describe the current
-- deadline, so both are cleared here to give the new date its own fresh
-- reminder cycle. No event is emitted here -- deliberately avoids adding
-- a "project.deadline_changed" notification on top of this, to keep this
-- pass from over-notifying (see docs/WORKSPACE-NOTIFICATIONS-LIFECYCLE.md).
--
-- A dedicated trigger, not folded into auto_set_project_completed_date.sql
-- -- that function's whole purpose is the completed_date lifecycle rule;
-- this is an unrelated concern (notification-cooldown bookkeeping), and
-- projects already comfortably hosts multiple independent BEFORE
-- triggers side by side.
create or replace function public.reset_project_deadline_reminder_cooldowns()
returns trigger
language plpgsql
as $$
begin
    if old.target_end_date is distinct from new.target_end_date then
        new.deadline_reminder_sent_at := null;
        new.overdue_last_notified_at := null;
    end if;

    return new;
end;
$$;
