-- attendance_types: separate "an employee may pick this when clocking in live"
-- from "this type exists at all".
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 3 (independent of
-- steps 1-2; must precede step 4's seed, which sets the column).
--
-- WHY
--
-- hyrax-data-platform's attendance_types_cleanup_migration.sql DELETED the
-- 'Office' and 'Blending Plant' rows to enforce the policy documented in
-- docs/hr/ATTENDANCE-SELF-SERVICE-ARCHITECTURE.md: "Office and Blending Plant
-- are scanner-only. The app's clock-in form is remote-only." Being physically
-- badged in at a company site and being clocked in remotely through the app
-- are mutually exclusive by design.
--
-- That policy still holds for LIVE clock-in. But it leaves HR no way to
-- reconcile the one case the policy didn't anticipate: the scanner failed, or
-- the employee forgot to tap, on a day they genuinely were at the Office or
-- the Blending Plant. Without those two type rows, HR has to record a
-- scanner-failure day as something it wasn't.
--
-- So the rows come back, but gated: is_self_selectable = false keeps them out
-- of the live clock-in dropdown (preserving the original policy exactly) while
-- making them available to the backfill path, which is a deliberate,
-- reason-coded correction rather than a self-service assertion of presence.
--
-- Defaults to true so the four existing rows (Site Visit, Business Meeting,
-- Work From Home, Training) keep their current behaviour with no UPDATE.
alter table public.attendance_types
    add column if not exists is_self_selectable boolean not null default true;

-- is_full_day: this type is recorded as WHOLE DAYS, never as a clock in/out
-- pair. It maps onto the standard time-and-attendance distinction between a
-- punch entry (an in/out pair, measured) and a pay-code entry (a day,
-- declared).
--
-- True only for the two business-trip types. A trip generates a flat DAILY
-- allowance (1x normal, 2x on an overseas weekend, or a Replacement Leave day
-- on a local weekend -- docs/hr/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md) and
-- never overtime, so asking for hours would only manufacture OT against the
-- exact figure the claims layer is meant to reconcile against.
--
-- Deliberately NOT true for:
--   Driving Duty  -- lorry and company drivers "always have OT, working out of
--                    the office" (confirmed with HR), so their real hours are
--                    the whole point of recording the day at all.
--   Company Event -- can be a half-day.
--   Training      -- can be a half-day session.
--
-- `default false` is the safe polarity: a row created by hand in Studio later
-- defaults to timed, which shows visible, correctable time inputs rather than
-- silently recording a whole day. The frontend tests `=== true` for the same
-- reason.
--
-- A full-day type still WRITES clock times -- attendance_activities has no
-- duration column and clocked_out_at must never be null. The times are derived
-- from the chosen day shape (full / AM half / PM half) plus the employee's
-- work location, server-side in create_attendance_backfill(). The UI simply
-- never asks for them.
alter table public.attendance_types
    add column if not exists is_full_day boolean not null default false;

comment on column public.attendance_types.is_full_day is
    'Recorded as whole days rather than a clock in/out pair (the punch-entry '
    'vs pay-code-entry distinction). True only for the business-trip types, '
    'whose allowance is a flat daily entitlement and which never generate '
    'overtime. A full-day type still writes clock times -- derived from the '
    'chosen day shape plus the employee work location in '
    'create_attendance_backfill() -- the UI just never asks for them.';

comment on column public.attendance_types.is_self_selectable is
    'Whether an employee may choose this type when clocking in live through '
    'the app. False for scanner-only locations (Office, Blending Plant), which '
    'exist only so HR/the employee can reconcile a failed-scanner day. The '
    'backfill form shows every type regardless of this flag; only the live '
    'clock-in form filters on it (src/data/attendanceActivityConfig.js).';
