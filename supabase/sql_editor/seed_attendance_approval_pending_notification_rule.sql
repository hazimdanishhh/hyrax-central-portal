-- Run this in the Supabase SQL editor, after
-- check_attendance_approvals_pending.sql. SAFE TO RE-RUN -- it deletes the
-- rules it is about to insert first, so it is idempotent.
--
-- ===========================================================================
-- REPLACES the single 'attendance.approval_pending' rule (2026-09-23)
-- ===========================================================================
-- That rule targeted the manager AND all of HR from ONE event, which was fine
-- when the event was per-row and the link was a bare path. It is no longer
-- workable: the notification is now consolidated per recipient, and a manager
-- and an HR reviewer need DIFFERENT links -- their own Team Attendance list
-- versus the HR Attendance list. A notification_events row carries a single
-- link_to, so one event cannot serve both.
--
-- Hence two event types, each with its own rule and its own audience. See
-- check_attendance_approvals_pending.sql for the full reasoning, including why
-- the old shape produced ten notifications to every HR person when one
-- employee backfilled ten days of their own attendance.
--
-- The old rule is deleted rather than left inactive: nothing emits
-- 'attendance.approval_pending' any more, so leaving it would be a dead row
-- that reads like a live route.
-- ===========================================================================

delete from public.notification_rules
where event_type in (
    'attendance.approval_pending',            -- superseded
    'attendance.approval_pending_manager',
    'attendance.approval_pending_hr'
);

-- MANAGER: one notification per manager, covering all of their reports'
-- pending rows. Targeted ONLY via the payload key -- no target_roles /
-- target_departments, because the recipient is not "managers in general", it
-- is specifically the manager the event was aggregated for. Setting
-- target_roles => array['manager'] here would send every manager's digest to
-- every other manager, since fan_out_notification_event UNIONs the role match
-- with the payload-key match.
insert into public.notification_rules (
    event_type,
    target_roles,
    target_departments,
    target_payload_keys,
    channels
) values (
    'attendance.approval_pending_manager',
    array[]::text[],
    array[]::text[],
    array['manager_profile_id'],
    array['in_app', 'email']
);

-- HR: one company-wide digest per run.
--
-- target_roles and target_departments are ANDed by
-- fan_out_notification_event.sql, so this resolves to profiles in the HR
-- department whose role is manager or staff -- the same audience the previous
-- rule had. Superadmin is deliberately not targeted, matching every other rule
-- in this system: superadmin is a break-glass catch-all, not a routine
-- approver expected to action every pending item company-wide.
--
-- No target_payload_keys: the digest is not about any one person, so there is
-- no profile id in the payload to route on.
insert into public.notification_rules (
    event_type,
    target_roles,
    target_departments,
    target_payload_keys,
    channels
) values (
    'attendance.approval_pending_hr',
    array['manager', 'staff'],
    array['HR'],
    array[]::text[],
    array['in_app', 'email']
);
