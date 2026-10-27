-- ############################################################################
-- Security hardening (2026-10-27) -- found by the full catalog audit
-- (supabase/catalog/*.csv, supabase/diagnostics/export_full_catalog.sql).
-- Run once, top to bottom, in the Supabase SQL editor.
--
-- 1. sap_gl_journal_lines_with_entry_info had no security_invoker, so it ran
--    with its owner's rights and ignored the Finance / MGM / Superadmin RLS
--    on sap_gl_journal_lines and sap_gl_journal_entries: ANY signed-in user
--    -- and anyone holding the public anon key -- could read every GL line.
--    With security_invoker the tables' own policies apply: the Account
--    Ledger page keeps working for Finance, MGM and Superadmin, and no one
--    else.
--
-- 2. The anon role (a visitor who is NOT signed in -- the anon key ships in
--    the website's JavaScript) needs nothing in the database: the login page
--    only calls supabase.auth. Until now anon could read employees_public
--    (names, work emails and phones, managers, today's attendance and leave
--    -- the view bypasses RLS by design, for signed-in staff) and the GL view
--    above, and could CALL 57 SECURITY DEFINER functions -- e.g. send the
--    payroll-reconciliation emails, fan out notifications, open onboarding /
--    offboarding cases, re-run the sales projection refresh.
--    => anon loses every table, view, sequence and function privilege in
--       public, now and for objects created later.
--
-- 3. Signed-in users keep EXACTLY the function access they have today
--    (checked per function before anything is revoked), except the 19
--    functions only cron or other trusted functions run -- a signed-in user
--    could otherwise trigger payroll emails or notification runs at will.
--    Cron runs as postgres and SECURITY DEFINER callers run as their owner,
--    so neither is affected.
--
-- 4. Views are read-only to signed-in users (Supabase's defaults had granted
--    INSERT / UPDATE / DELETE / TRUNCATE on every view).
--
-- Undo: grants can be restored with GRANT; nothing is dropped.
-- ############################################################################

-- 1 ── the GL lines view follows the tables' RLS ─────────────────────────────
alter view public.sap_gl_journal_lines_with_entry_info set (security_invoker = on);

-- 3 ── functions: keep signed-in access as it is, then close PUBLIC / anon ──
do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as sig,
               has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ok,
               has_function_privilege('service_role', p.oid, 'EXECUTE') as svc_ok
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    loop
        if r.auth_ok then execute format('grant execute on function %s to authenticated', r.sig); end if;
        if r.svc_ok then execute format('grant execute on function %s to service_role', r.sig); end if;
        execute format('revoke execute on function %s from public, anon', r.sig);
    end loop;
end
$$;

-- Only cron (or a SECURITY DEFINER caller) runs these -- not signed-in users.
-- check_employee_confirmation_status_mismatches is a manual diagnostic: run
-- it from the SQL editor.
do $$
declare
    r record;
begin
    for r in
        select p.oid::regprocedure as sig
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in (
              'check_attendance_approvals_pending',
              'check_attendance_autoclockout_approaching_evening',
              'check_attendance_autoclockout_approaching_midnight',
              'check_employee_confirmation_status_mismatches',
              'check_employee_confirmations_due_soon',
              'check_employee_confirmations_overdue',
              'check_employee_contract_actions_due',
              'check_employee_contract_offboarding_due',
              'check_employee_offboarding_hr_items_approaching',
              'check_employee_offboarding_last_day_approaching',
              'check_employee_offboarding_overdue',
              'check_project_deadlines_approaching',
              'check_projects_overdue',
              'check_tasks_due_soon',
              'check_tasks_overdue',
              'fan_out_notification_event',
              'refresh_sales_projection_caches',
              'refresh_sales_projection_ensemble_cache',
              'send_payroll_reconciliation_hr_digest',
              'send_payroll_reconciliation_notifications',
              'task_notification_link')
    loop
        execute format('revoke execute on function %s from authenticated', r.sig);
    end loop;
end
$$;

-- 2 ── anon: nothing on tables, views, materialized views, sequences ───────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 4 ── views are read-only for signed-in users ──────────────────────────────
do $$
declare
    r record;
begin
    for r in
        select c.oid::regclass as rel
        from pg_class c
        where c.relnamespace = 'public'::regnamespace
          and c.relkind in ('v', 'm')
    loop
        execute format('revoke insert, update, delete, truncate, references, trigger on %s from authenticated', r.rel);
    end loop;
end
$$;

-- 2/3 ── the same for every object created from now on ─────────────────────
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public grant execute on functions to authenticated, service_role;

-- CHECK (run after): both should return no rows.
-- select table_name, privilege_type from information_schema.role_table_grants
--   where grantee = 'anon' and table_schema = 'public';
-- select routine_name from information_schema.role_routine_grants
--   where grantee in ('anon', 'PUBLIC') and routine_schema = 'public';
