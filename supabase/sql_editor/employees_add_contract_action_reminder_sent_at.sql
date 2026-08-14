-- Run this once in the Supabase SQL editor.
--
-- One-shot dedup guard for the "contract action due" scheduled scan (see
-- check_employee_contract_actions_due.sql) -- same shape as
-- confirmation_reminder_sent_at, since a contract-due window resolves the
-- same way a confirmation-due-soon window does (the end_date either passes
-- or gets acted on, it isn't an ongoing queue to re-nag about).
alter table public.employees
    add column if not exists contract_action_reminder_sent_at timestamptz;
