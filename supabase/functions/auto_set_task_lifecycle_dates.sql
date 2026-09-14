-- arguments: none (trigger function)
-- returns: trigger
--
-- Companion to auto_activate_project_on_task_started.sql, but a distinct
-- BEFORE trigger, not folded into that one -- different timing (BEFORE,
-- since this mutates NEW's own row before it's written, vs that one's
-- AFTER, which reads/writes the separate projects row) and a different
-- concern.
--
-- Bidirectional: both status->date (original) and date->status (added
-- 2026-09, so a direct edit of start_date/completed_date on the task edit
-- form -- which leaves both freely editable alongside the guarded
-- TaskCard status buttons -- can't diverge into an inconsistent state,
-- e.g. a COMPLETED task with no completed_date, or a TO_DO task sitting
-- on a start_date).
--
-- CANCELLED is exempt from the date->status rules below -- it's terminal
-- (taskStatusMeta.js: no Revert button, no dropdown escape hatch), so
-- editing a cancelled task's dates corrects the record without
-- resurrecting it. Clearing completed_date while status stays COMPLETED
-- (or start_date while IN_PROGRESS) is refused -- the date snaps back to
-- its prior value rather than silently breaking the "status implies
-- date" invariant or silently reverting status.
--
-- Fires on every UPDATE regardless of which columns changed -- an
-- ordinary details-only edit (title/due_date/description) leaves
-- old.status = new.status and old.start_date/completed_date = new.*,
-- so every branch below no-ops and the row passes through untouched.
create or replace function public.auto_set_task_lifecycle_dates()
returns trigger
language plpgsql
as $$
begin
    -- Date-driven promotion: setting completed_date drives status to
    -- COMPLETED the same way the "Complete" button does.
    if new.status <> 'CANCELLED'
       and new.completed_date is not null
       and (TG_OP = 'INSERT' or old.completed_date is distinct from new.completed_date)
       and new.status is distinct from 'COMPLETED' then
        new.status := 'COMPLETED';
    end if;

    -- Setting start_date drives status to IN_PROGRESS the same way
    -- "Start" does -- but only from TO_DO, and only if the task isn't
    -- already completed (a completed_date always wins over a start_date
    -- set in the same update, see the guard above).
    if new.status = 'TO_DO'
       and new.start_date is not null
       and (TG_OP = 'INSERT' or old.start_date is distinct from new.start_date)
       and new.completed_date is null then
        new.status := 'IN_PROGRESS';
    end if;

    -- Status-driven half (original): a transition via the TaskCard
    -- buttons stamps the matching date. start_date is stamped once, the
    -- first time a task reaches IN_PROGRESS -- coalesce so a manually
    -- pre-set start_date is never overwritten. Never cleared once set --
    -- Revert (COMPLETED -> IN_PROGRESS) must not erase that the task
    -- genuinely started.
    if new.status = 'IN_PROGRESS'
       and (TG_OP = 'INSERT' or old.status is distinct from new.status) then
        new.start_date := coalesce(new.start_date, current_date);
    end if;

    if new.status = 'COMPLETED' then
        -- coalesce covers three cases in one expression: a fresh
        -- transition into COMPLETED (old.completed_date is null, so this
        -- falls through to current_date); an explicitly-submitted
        -- completed_date (via the date-driven rule above, or a direct
        -- edit -- kept exactly as submitted, never stomped to today);
        -- and an attempted clear while status stays COMPLETED (new value
        -- is null, so this falls back to old.completed_date, refusing
        -- the clear rather than leaving a COMPLETED task with no
        -- completed_date).
        new.completed_date := coalesce(
            new.completed_date,
            case when TG_OP = 'UPDATE' then old.completed_date end,
            current_date
        );
    elsif new.status is distinct from 'COMPLETED' then
        new.completed_date := null;
    end if;

    -- Same "refuse the clear" treatment for start_date while IN_PROGRESS.
    if new.status = 'IN_PROGRESS' and new.start_date is null and TG_OP = 'UPDATE' then
        new.start_date := old.start_date;
    end if;

    return new;
end;
$$;
