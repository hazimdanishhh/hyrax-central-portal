-- Run this once in the Supabase SQL editor.
--
-- Two dedicated one-shot dedup columns for the new
-- attendance.autoclockout_approaching reminder (see
-- check_attendance_autoclockout_approaching_evening.sql /
-- ..._midnight.sql). Deliberately NOT reusing attendance_activities'
-- existing last_reminder_sent_at column -- that one is already the
-- cooldown for the unrelated attendance.approval_pending rule (see
-- attendance_activities_add_last_reminder_sent_at.sql). Two separate
-- columns, not one shared column, because a row still open at the evening
-- check that is somehow still open at the midnight check must still get
-- its own, distinct midnight warning -- a single shared one-shot flag
-- would incorrectly skip that second warning.
alter table public.attendance_activities
    add column if not exists evening_autoclockout_warned_at timestamptz,
    add column if not exists midnight_autoclockout_warned_at timestamptz;
