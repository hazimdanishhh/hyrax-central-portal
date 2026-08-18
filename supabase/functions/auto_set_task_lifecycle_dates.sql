-- arguments: none (trigger function)
-- returns: trigger
--
-- Companion to auto_activate_project_on_task_started.sql, but a distinct
-- BEFORE trigger, not folded into that one -- different timing (BEFORE,
-- since this mutates NEW's own row before it's written, vs that one's
-- AFTER, which reads/writes the separate projects row) and a different
-- concern. Same transition-detection idiom as that trigger
-- (TG_OP = 'INSERT' or old.status is distinct from new.status, guarded by
-- AND/OR short-circuit so `old` is never dereferenced on INSERT, when it
-- isn't assigned yet).
--
-- start_date: stamped once, the first time a task reaches IN_PROGRESS
-- (on insert or update) -- coalesce so a manually pre-set start_date is
-- never overwritten. Never cleared once set -- there is no reverse rule,
-- deliberately: Revert (COMPLETED -> IN_PROGRESS, see taskStatusMeta.js)
-- must NOT erase the fact the task genuinely started.
--
-- completed_date: stamped fresh on every genuine transition INTO
-- COMPLETED, and unconditionally cleared the instant status is anything
-- OTHER than COMPLETED -- regardless of which path got it there (Cancel,
-- Revert, or any future transition off COMPLETED). This is the "robust"
-- half: a single hardcoded "if new.status = 'IN_PROGRESS' and old.status
-- = 'COMPLETED' then null it out" would only cover the Revert button and
-- silently miss any other future path off COMPLETED; this covers all of
-- them by construction.
--
-- Fires on every UPDATE regardless of which columns changed (same as the
-- precedent trigger) -- an ordinary details-only edit (title/due_date/
-- description, or a manual start_date/completed_date edit with status
-- unchanged) leaves old.status = new.status, so both branches below
-- no-op and whatever the caller submitted for start_date/completed_date
-- passes through completely untouched.
create or replace function public.auto_set_task_lifecycle_dates()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'IN_PROGRESS'
       and (TG_OP = 'INSERT' or old.status is distinct from new.status) then
        new.start_date := coalesce(new.start_date, current_date);
    end if;

    if new.status = 'COMPLETED'
       and (TG_OP = 'INSERT' or old.status is distinct from new.status) then
        new.completed_date := current_date;
    elsif new.status is distinct from 'COMPLETED' then
        new.completed_date := null;
    end if;

    return new;
end;
$$;
