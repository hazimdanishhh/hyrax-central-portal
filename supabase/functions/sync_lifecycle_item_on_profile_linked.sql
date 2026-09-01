-- arguments: none (trigger function)
-- returns: trigger
--
-- A new sibling trigger on the SAME event notify_employee_profile_linked.sql
-- already watches (AFTER INSERT OR UPDATE on employees) -- Postgres fires
-- multiple triggers per event without conflict, so this coexists rather
-- than replacing anything in Section A. Its only job: when profile_id is
-- newly set/changed, mark this employee's OPEN onboarding case's
-- 'profile_linked' item DONE -- the "derive, don't duplicate" item, synced
-- into a real row at the exact moment the underlying fact
-- (employees.profile_id IS NOT NULL) becomes true, the same "plain column
-- auto-stamped by a trigger" pattern tasks.start_date/completed_date
-- already establish, one layer removed.
--
-- Does not fire notify_employee_profile_linked.sql's own event -- that
-- stays exactly as designed; this trigger only touches
-- employee_lifecycle_case_items.
--
-- SECURITY DEFINER: writes into employee_lifecycle_case_items on behalf of
-- whichever actor's edit fired this (HR editing Employee Management, or
-- the link_profile_to_employee RPC), whose RLS standing was earned on
-- employees, not on the checklist tables.
create or replace function public.sync_lifecycle_item_on_profile_linked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.profile_id is not null
       and (TG_OP = 'INSERT' or old.profile_id is distinct from new.profile_id) then
        update public.employee_lifecycle_case_items
        set status = 'DONE', completed_at = now(), completed_by = null
        where item_key = 'profile_linked'
          and status <> 'DONE'
          and case_id in (
              select id from public.employee_lifecycle_cases
              where employee_id = new.id and case_type = 'ONBOARDING' and status = 'OPEN'
          );
    end if;

    return new;
end;
$$;
