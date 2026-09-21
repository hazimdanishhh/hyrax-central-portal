-- Run this once in the Supabase SQL editor, AFTER
-- notify_attendance_clocked_in.sql has been created.
--
-- DEPLOYMENT STEP 5 -- this MUST be redeployed BEFORE
-- create_attendance_backfill_rpc.sql is put in place. Deploy them the other
-- way round and the very first backfill sends every affected employee one
-- bogus "You are now clocked in -- remember to clock out" notification per day
-- created (5 employees x 10 days = 50 wrong messages, all about closed
-- sessions in the past).
--
-- The WHEN clause is what keeps a bulk backfill cheap -- the function isn't
-- invoked at all for those rows. notify_attendance_clocked_in() carries the
-- same guard internally so it stays correct standalone; see its header.
--
-- `create or replace trigger` requires Postgres 14+. Supabase is 15+ here,
-- already relied upon by public_holidays_migration.sql's NULLS NOT DISTINCT
-- index.
create or replace trigger trg_notify_attendance_clocked_in
after insert on public.attendance_activities
for each row
when (new.entry_method = 'self_clock_in' and new.clocked_out_at is null)
execute function public.notify_attendance_clocked_in();
