-- queue_payroll_reconciliation_email: backs the "Send Email" button in
-- PayrollReconciliationSidebar.jsx. Queues ONE HTML reconciliation email
-- for ONE employee's ONE period onto the existing async email pipeline
-- (email_queue -> send-queued-emails Edge Function, pg_cron every 5 min --
-- see notifications_schema_migration.sql) rather than sending
-- synchronously -- reuses the already-deployed, already-working sender
-- instead of standing up a second one.
--
-- Reuses get_payroll_reconciliation_rows() (the same shared helper
-- get_payroll_reconciliation_detail_rpc.sql calls) so the emailed list can
-- never disagree with what the sidebar showed HR right before they clicked
-- Send. Also writes one payroll_reconciliation_email_sends row so the
-- sidebar can show "Last requested: <date> by <HR user>".
--
-- Deliberately single-employee -- bulk "Send to All" for a whole period is
-- out of scope for this pass; a future bulk RPC can simply loop this one
-- call per employee.
--
-- SECURITY DEFINER: an HR user's own session has no INSERT policy on
-- email_queue or payroll_reconciliation_email_sends (both are
-- superadmin-only / HR-select-only tables) -- same reasoning
-- fan_out_notification_event.sql already documents for writing email_queue
-- on another user's behalf. set search_path = '' + fully-qualified
-- public.* names: same hardening as every other SECURITY DEFINER function
-- in this schema.
create or replace function public.queue_payroll_reconciliation_email(
    p_employee_uuid uuid,
    p_start_date    date,
    p_end_date      date
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_is_hr_or_superadmin boolean;
    v_employee_name  text;
    v_recipient_email text;
    v_subject text;
    v_body_html text;
    v_section_html text;
    v_glossary_label text;
    v_glossary_description text;
    v_glossary_action_text text;
    v_queue_id bigint;
    -- Fixed display order, independent of whatever row order
    -- payroll_reconciliation_glossary happens to be seeded/edited in later
    -- -- matches PayrollReconciliationSidebar.jsx's own fixed 4-section
    -- order (Absences, Leave Conflicts, Insufficient Half-Day Hours, Leave
    -- Data Errors) 1:1, so the emailed list and the sidebar can never show
    -- the categories in a different order from each other.
    v_category_order constant text[] := array['absent', 'leave_conflict', 'insufficient_half_day', 'leave_fraction_error'];
    v_code text;
begin
    select (public.is_superadmin() or p.department_id = 7)
    into v_is_hr_or_superadmin
    from public.profiles p
    where p.id = auth.uid();

    if not coalesce(v_is_hr_or_superadmin, false) then
        raise exception 'Unauthorized: queue_payroll_reconciliation_email requires HR/superadmin' using errcode = '42501';
    end if;

    if p_employee_uuid is null or p_start_date is null or p_end_date is null then
        raise exception 'queue_payroll_reconciliation_email requires p_employee_uuid, p_start_date, and p_end_date' using errcode = '22004';
    end if;

    select e.full_name, coalesce(e.email_work, e.email_personal)
    into v_employee_name, v_recipient_email
    from public.employees e
    where e.id = p_employee_uuid;

    if v_employee_name is null then
        raise exception 'No employee found for %', p_employee_uuid using errcode = '22023';
    end if;

    -- Never a silent failure -- the frontend should already gate Send on
    -- get_payroll_period_summary's own resolvedEmail column, so reaching
    -- this exception means the employee's email was removed between load
    -- and click, or the gate was bypassed.
    if v_recipient_email is null then
        raise exception 'Cannot send: % has no work or personal email on file', v_employee_name using errcode = '22023';
    end if;

    v_subject := format(
        'Attendance Reconciliation Needed — %s — %s to %s',
        v_employee_name,
        to_char(p_start_date, 'DD Mon YYYY'),
        to_char(p_end_date, 'DD Mon YYYY')
    );

    v_body_html := format(
        '<p>Hi %s,</p><p>The following attendance items for %s to %s need review before this cycle''s payroll can be finalized.</p>',
        v_employee_name,
        to_char(p_start_date, 'DD Mon YYYY'),
        to_char(p_end_date, 'DD Mon YYYY')
    );

    foreach v_code in array v_category_order
    loop
        select g.label, g.description, g.employee_action_text
        into v_glossary_label, v_glossary_description, v_glossary_action_text
        from public.payroll_reconciliation_glossary g
        where g.code = v_code and g.is_active;

        select string_agg(
            format('<li>%s</li>', to_char(r.work_date, 'DD Mon YYYY (Dy)')),
            ''
            order by r.work_date
        )
        into v_section_html
        from public.get_payroll_reconciliation_rows(p_employee_uuid, p_start_date, p_end_date) r
        where r.category = v_code;

        v_body_html := v_body_html || format(
            '<h3>%s</h3><p>%s</p><p><em>%s</em></p>%s',
            coalesce(v_glossary_label, v_code),
            coalesce(v_glossary_description, ''),
            coalesce(v_glossary_action_text, ''),
            case
                when v_section_html is null then '<p>None — all clear.</p>'
                else '<ul>' || v_section_html || '</ul>'
            end
        );
    end loop;

    insert into public.email_queue (to_email, subject, body_html)
    values (v_recipient_email, v_subject, v_body_html)
    returning id into v_queue_id;

    insert into public.payroll_reconciliation_email_sends
        (employee_id, period_start, period_end, email_queue_id, queued_by)
    values
        (p_employee_uuid, p_start_date, p_end_date, v_queue_id, public.current_employee_id());

    return v_queue_id;
end;
$$;
