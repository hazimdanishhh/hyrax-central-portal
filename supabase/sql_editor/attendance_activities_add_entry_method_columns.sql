-- attendance_activities: record HOW each row got here, separately from WHAT
-- the person was doing.
--
-- Run this once in the Supabase SQL editor. DEPLOYMENT STEP 2 -- requires
-- attendance_adjustment_reasons_migration.sql (step 1) for the FK below.
--
-- WHY A COLUMN AND NOT A NEW attendance_types ROW
--
-- attendance_types answers "what kind of work was this" (Site Visit, Work From
-- Home, Overseas Trip...). That is the dimension the future claims/allowance
-- layer reconciles against -- trip_allowance_claims has to be able to ask "did
-- attendance record an Overseas Trip on this date?"
-- (docs/hr/OVERTIME-WEEKEND-HOLIDAY-CLAIMS-DESIGN.md).
--
-- "The scanner failed" is not a kind of work. An Office day backfilled by HR
-- is still an Office day for hours_worked, overtime_hours, is_worked_on_holiday
-- and every statutory rate-tier estimate. Encoding provenance as a TYPE would
-- corrupt the exact field the claims layer reads -- which is a milder version
-- of the mistake that got the self-selectable 'Overtime' type deleted in
-- hyrax-data-platform's attendance_types_cleanup_migration.sql (a self-reported
-- label competing with an independently calculated figure). Two orthogonal
-- dimensions instead: type = what, entry_method = how.
--
-- text + check, not a postgres enum: this schema has exactly one real enum
-- (attendance_approval_status) and uses `text check (col in (...))` everywhere
-- else -- public_holidays.category, project_members.role,
-- leave_ledger_sync_log.status.
alter table public.attendance_activities
    -- 'self_clock_in'            -- the employee clocked in live through the app
    -- 'employee_reconciliation'  -- the employee filled in their own past day
    -- 'manager_backfill'         -- a manager filled in a direct report's day
    -- 'hr_backfill'              -- HR/superadmin filled in someone's day
    --
    -- The default is correct for every pre-existing row, not just convenient:
    -- until this migration the app had exactly one insert path into this table
    -- (clockInAttendanceActivity / createAttendanceActivity, both live
    -- self-service clock-ins), so every historical row genuinely was a self
    -- clock-in.
    add column if not exists entry_method text not null default 'self_clock_in'
        check (entry_method in (
            'self_clock_in',
            'employee_reconciliation',
            'manager_backfill',
            'hr_backfill'
        )),

    -- Null for a self_clock_in row -- a live clock-in needs no justification.
    -- Required by create_attendance_backfill() for every other entry_method.
    add column if not exists adjustment_reason_id bigint
        references public.attendance_adjustment_reasons(id),

    -- Who entered the row, as distinct from approved_by (who signed it off).
    -- Nullable: historical rows have no recoverable creator, and inventing one
    -- would be worse than admitting we don't know.
    add column if not exists created_by uuid references public.employees(id);

-- Index for create_attendance_backfill()'s existence/overlap checks, which
-- look up "this employee's rows on this MYT day".
--
-- DELIBERATELY NOT an expression index on
-- date(clocked_in_at at time zone 'Asia/Kuala_Lumpur') -- the two-argument
-- form of timezone() is STABLE, not IMMUTABLE (its result depends on the tz
-- database), and Postgres rejects a STABLE expression in an index with
-- "functions in index expression must be marked IMMUTABLE". A plain composite
-- index plus half-open timestamptz range predicates in the RPC
-- (clocked_in_at >= day_start and clocked_in_at < day_start + interval '1 day')
-- gives the same lookup and is actually usable by the planner.
create index if not exists idx_attendance_activities_employee_clocked_in
    on public.attendance_activities (employee_id, clocked_in_at);

comment on column public.attendance_activities.entry_method is
    'How this row was created: self_clock_in (live app clock-in), '
    'employee_reconciliation, manager_backfill, or hr_backfill. Orthogonal to '
    'attendance_type_id, which records what kind of work it was. Rows that are '
    'not self_clock_in have asserted rather than observed times.';

comment on column public.attendance_activities.created_by is
    'Who entered this row, as distinct from approved_by (who signed it off). '
    'Null for rows predating the entry_method migration.';
