-- Run this once in the Supabase SQL editor.
--
-- Cooldown guard for the "attendance approval pending" scheduled scan (see
-- check_attendance_approvals_pending.sql). Same reasoning as
-- employees.confirmation_overdue_last_notified_at -- a pending approval is
-- a live queue that should be re-nagged about periodically until someone
-- approves/rejects it, not a one-shot notification.
alter table public.attendance_activities
    add column if not exists last_reminder_sent_at timestamptz;
