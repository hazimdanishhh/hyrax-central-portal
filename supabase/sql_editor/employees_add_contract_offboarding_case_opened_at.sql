-- Run once in the Supabase SQL editor, before
-- check_employee_contract_offboarding_due.sql. One-shot dedup column for
-- that scan -- separate from employees.contract_action_reminder_sent_at
-- (check_employee_contract_actions_due.sql's own dedup), since these are
-- two independent facts: a case could already exist (opened manually)
-- before this scan ever runs for a given employee.
alter table public.employees add column if not exists contract_offboarding_case_opened_at timestamptz;
