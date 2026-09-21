-- New attendance_types rows: business trips, company events, driver duty, and
-- the two backfill-only scanner locations.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 4 -- requires
-- attendance_types_add_is_self_selectable_column.sql (step 3).
--
-- IDEMPOTENCY: attendance_types has NO unique constraint on `name` (this table
-- has no seed-file precedent at all -- every existing row was created by hand
-- in Studio), so `on conflict (name) do nothing` would fail with "there is no
-- unique or exclusion constraint matching the ON CONFLICT specification".
-- Guarded `insert ... select ... where not exists` per row instead. Not
-- race-safe, but this is a one-shot manual seed, not a concurrent write path.
--
-- requires_photo / requires_location / requires_notes are all left false to
-- match every existing row -- src/data/attendanceActivityConfig.js has its
-- photo and location fields commented out, so those two flags are currently
-- unenforced anywhere and setting them here would be decorative.

-- ---------------------------------------------------------------------------
-- Self-selectable: real kinds of work an employee can be doing live.
-- ---------------------------------------------------------------------------

-- Overseas Trip and Local Trip are deliberately SEPARATE rows, not one
-- "Business Trip" with a sub-field. Their weekend rules genuinely differ --
-- an overseas-trip weekend day pays 2x the daily allowance, a local-trip
-- weekend day pays no extra allowance and instead grants 1 day of Replacement
-- Leave (docs/hr/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md, confirmed with
-- HR). Collapsing them into one type would destroy the only distinction the
-- allowance rule depends on.
insert into public.attendance_types
    (name, requires_photo, requires_location, requires_notes, is_self_selectable, is_full_day)
select 'Overseas Trip', false, false, false, true, true
where not exists (
    select 1 from public.attendance_types where name = 'Overseas Trip'
);

insert into public.attendance_types
    (name, requires_photo, requires_location, requires_notes, is_self_selectable, is_full_day)
select 'Local Trip', false, false, false, true, true
where not exists (
    select 1 from public.attendance_types where name = 'Local Trip'
);

-- Attended work that is neither Training (which implies instruction) nor a
-- client-facing Site Visit: annual dinner, townhall, team building, CSR day.
insert into public.attendance_types
    (name, requires_photo, requires_location, requires_notes, is_self_selectable, is_full_day)
select 'Company Event', false, false, false, true, false
where not exists (
    select 1 from public.attendance_types where name = 'Company Event'
);

-- Driving Duty exists because the scanners are DOOR ACCESS devices, not time
-- clocks (confirmed with the user). Lorry drivers badge in at the plant and
-- then drive out for the day -- the driving itself is recorded nowhere.
-- Company/personal drivers badge in, are rarely at the office, and work out of
-- it. For both, the work that happens away from a door is structurally
-- invisible every single day, not as an occasional exception -- so it needs a
-- type of its own rather than being reconciled day-by-day as if it were an
-- anomaly.
--
-- OPEN QUESTION for whoever builds the claims layer: lorry-driver trips and
-- executive-driver standby may warrant separate types if their OT/allowance
-- treatment differs -- the same reason Overseas and Local Trip were split.
-- Left as one row because splitting later is a single INSERT, whereas merging
-- two rows after they have history is not.
insert into public.attendance_types
    (name, requires_photo, requires_location, requires_notes, is_self_selectable, is_full_day)
select 'Driving Duty', false, false, false, true, false
where not exists (
    select 1 from public.attendance_types where name = 'Driving Duty'
);

-- ---------------------------------------------------------------------------
-- Backfill-only: scanner locations, hidden from the live clock-in dropdown.
-- ---------------------------------------------------------------------------
--
-- These two were deleted by hyrax-data-platform's
-- attendance_types_cleanup_migration.sql to make live clock-in remote-only.
-- is_self_selectable = false preserves that policy exactly -- they never
-- reappear in the clock-in form -- while giving HR (and an employee whose
-- badge didn't register) a way to say which site a failed-scanner day
-- actually happened at.
--
-- NOTE, not a bug: attendance_activity_audit's hw_events CTE also emits
-- attendance_logs.scanner_location as `attendance_type`, using these same two
-- strings. A day with both a real Office scan and a backfilled Office row
-- therefore shows two "Office" cards in the Activity Timeline. The hours are
-- computed correctly regardless (daily_hw_remote_overlap subtracts the
-- overlap), and the two cards are told apart by the entry_method provenance
-- badge on the backfilled one.
insert into public.attendance_types
    (name, requires_photo, requires_location, requires_notes, is_self_selectable, is_full_day)
select 'Office', false, false, false, false, false
where not exists (
    select 1 from public.attendance_types where name = 'Office'
);

insert into public.attendance_types
    (name, requires_photo, requires_location, requires_notes, is_self_selectable, is_full_day)
select 'Blending Plant', false, false, false, false, false
where not exists (
    select 1 from public.attendance_types where name = 'Blending Plant'
);

-- Re-assert the gate for the two scanner locations even if a row already
-- existed from some earlier manual insert -- the guarded inserts above would
-- have skipped it and left it self-selectable.
update public.attendance_types
set is_self_selectable = false
where name in ('Office', 'Blending Plant')
  and is_self_selectable is distinct from false;

-- Re-assert is_full_day for the two trip types, for the same reason as the
-- block above: if a row already existed from an earlier manual insert, the
-- guarded insert skipped it and left the column at its `false` default.
update public.attendance_types
set is_full_day = true
where name in ('Overseas Trip', 'Local Trip')
  and is_full_day is distinct from true;
