-- Notification rule for 'attendance.backfilled' -- emitted by
-- create_attendance_backfill() when HR or a manager adds attendance rows on
-- someone else's behalf.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 6 -- before
-- create_attendance_backfill_rpc.sql (step 8) first runs. An event with no
-- matching rule is a silent no-op rather than an error, so this is ordering
-- hygiene rather than a hard dependency, but a backfill done before this is
-- seeded notifies nobody and cannot be replayed.
--
-- Its own file rather than an addition to an existing attendance seed, for
-- exactly the reason seed_attendance_clocked_out_notification_rule.sql records
-- for itself: the earlier seed files have already been executed, and
-- re-running one to pick up a new row would duplicate every row it already
-- inserted, double-firing those notifications.
--
-- Targets the employee whose attendance was added, resolved per event through
-- target_payload_keys -> employee_profile_id -- the same single-recipient
-- mechanism every other attendance rule uses.
--
-- in_app only, deliberately. The employee-facing email side of attendance
-- reconciliation is still gated on the app being in real company-wide use
-- rather than testing (see the "Planned: automated email" appendix in
-- docs/hr/PAYROLL-DATA-REQUIREMENTS.md). Flipping this to
-- array['in_app','email'] later is a data change, no code change.
--
-- NOTE: self-reconciliation deliberately emits NOTHING. Those rows land
-- 'Pending', and check_attendance_approvals_pending() plus
-- seed_attendance_approval_pending_notification_rule.sql already notify the
-- approver -- a second mechanism for the same fact could only disagree with
-- the first.
insert into public.notification_rules
    (event_type, condition, target_payload_keys, channels)
select 'attendance.backfilled', '{}'::jsonb,
       array['employee_profile_id'], array['in_app']
where not exists (
    select 1 from public.notification_rules
    where event_type = 'attendance.backfilled'
);
