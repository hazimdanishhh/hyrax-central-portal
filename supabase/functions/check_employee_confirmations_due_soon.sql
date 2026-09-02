-- arguments: none
-- returns: void
--
-- Scheduled-scan ("Shape B") notification source -- the counterpart to
-- log_sales_leads_stage_change.sql's change-triggered ("Shape A") one.
-- confirmation_date doesn't change as the deadline approaches -- nothing
-- in the row ever updates, so there's no row-change trigger to hook into.
-- Only today's date changes, which is why this has to be a periodic scan
-- (pg_cron, see supabase/sql_editor/schedule_check_employee_confirmations_cron.sql)
-- rather than a trigger.
--
-- "Due soon" is the SAME rule as get_hr_employees_dashboard_rpc.sql's
-- confirmations_due_soon_count KPI (Probation status, confirmation_date
-- still null, confirmation_due_date = join_date + 6 months, within the
-- next 30 days) -- deliberately kept identical so this notification and
-- that dashboard tile can never disagree about what "due soon" means.
--
-- confirmation_reminder_sent_at is the dedup guard (see
-- supabase/sql_editor/employees_add_confirmation_reminder_sent_at.sql) --
-- without it this would re-fire daily for the whole 30-day window.
--
-- manager_profile_id is resolved here (via employees.manager_id -> that
-- manager's own profile_id) and passed through the payload so
-- fan_out_notification_event() can notify that SPECIFIC manager via
-- notification_rules.target_payload_keys, not just role/department
-- targeting -- see seed_employee_confirmation_notification_rule.sql.
--
-- SECURITY DEFINER + set search_path = '': same hardening as every other
-- function in this system (see supabase/policies/profiles_crud.sql for why
-- this matters). This runs under pg_cron with no calling user session at
-- all, so it must be able to read across employees/employment_status and
-- write notifications for other users on its own authority.
create or replace function public.check_employee_confirmations_due_soon()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row record;
begin
    for v_row in
        select
            e.id,
            e.full_name,
            (e.join_date + interval '6 months')::date as confirmation_due_date,
            m.profile_id as manager_profile_id
        from public.employees e
        left join public.employees m on m.id = e.manager_id
        left join public.employment_status es on es.id = e.employment_status_id
        where es.name = 'Probation'
          and e.confirmation_date is null
          and (e.join_date + interval '6 months')::date
              between current_date and current_date + interval '30 days'
          and e.confirmation_reminder_sent_at is null
          -- Suppressed once offboarding has started (see
          -- docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md) -- an
          -- employee resigning mid-Probation (a real, confirmed scenario,
          -- not hypothetical) shouldn't also get "run their probation
          -- review" nudges alongside their own offboarding notifications.
          and not exists (
              select 1 from public.employee_lifecycle_cases c
              where c.employee_id = e.id and c.case_type = 'OFFBOARDING' and c.status = 'OPEN'
          )
    loop
        -- Each employee processed in its own block, same reasoning as
        -- fan_out_notification_event()'s per-rule wrapping: one bad row
        -- must not stop the rest of the scan from completing.
        begin
            perform public.emit_notification_event(
                'employee.confirmation_due_soon', 'employees', v_row.id::text,
                jsonb_build_object(
                    'employee_id', v_row.id,
                    'employee_name', v_row.full_name,
                    'confirmation_due_date', v_row.confirmation_due_date,
                    'manager_profile_id', v_row.manager_profile_id,
                    'title', 'Confirmation Review Due Soon',
                    'message', format(
                        '%s''s probation confirmation is due on %s.',
                        v_row.full_name, v_row.confirmation_due_date
                    ),
                    'link_to', '/app/employees/' || v_row.id
                )
            );

            update public.employees
                set confirmation_reminder_sent_at = now()
                where id = v_row.id;
        exception when others then
            raise warning 'confirmation reminder failed for employee %: %', v_row.id, sqlerrm;
        end;
    end loop;
end;
$$;
