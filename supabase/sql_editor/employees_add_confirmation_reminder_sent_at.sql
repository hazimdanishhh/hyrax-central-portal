-- Run this once in the Supabase SQL editor.
--
-- Dedup guard for the scheduled "confirmation due soon" reminder scan (see
-- supabase/functions/check_employee_confirmations_due_soon.sql). Without
-- this, the daily scan would re-notify the same employee's manager/HR every
-- single day between "30 days out" and the actual confirmation_due_date --
-- this column lets the scan skip anyone it's already fired for once.
--
-- Not a general-purpose audit field -- only ever written by
-- check_employee_confirmations_due_soon() itself.
alter table public.employees
    add column if not exists confirmation_reminder_sent_at timestamptz;
