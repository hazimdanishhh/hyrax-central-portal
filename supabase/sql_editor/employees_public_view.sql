create or replace view public.employees_public as
select
  e.id,
  e.full_name,
  e.preferred_name,
  e.email_work,
  e.phone_work,
  e.employment_status,
  e."position",
  e.department_id,
  d.name as department_name,
  e.employee_id,
  e.profile_id,
  -- Confirmed live 2026-09: CREATE OR REPLACE VIEW rejects renaming an
  -- existing output column even in place with a compatible type (42P16) --
  -- it requires the exact same name, not just the same position/type. Left
  -- as-is (still the raw employees.address_work text, not dropped from the
  -- table per the migration plan) -- the real replacement is
  -- work_location_name, appended at the end below with the other new
  -- columns.
  e.address_work,
  e.nationality_id,
  n.name as nationality_name,
  e.employment_type_id,
  et.name as employment_type_name,
  p.avatar_url,
  e.manager_id,
  m.full_name as manager_name,
  m.employee_id as manager_employee_id,
  m.profile_id as manager_profile_id,
  m.preferred_name as manager_preferred_name,
  m."position" as manager_position,
  m.phone_work as manager_phone,
  m.email_work as manager_email,
  -- Confirmed dead (zero frontend consumers) -- nulled out rather than
  -- physically removed: CREATE OR REPLACE VIEW only allows appending new
  -- columns at the end or renaming one in place, never removing a column
  -- from the middle of the list (manager_avatar_url etc. follow this one),
  -- so a true drop would need DROP VIEW + CREATE VIEW, which isn't done
  -- here without a live DB session to verify nothing else depends on it.
  null::text as manager_address_work,
  mp.avatar_url as manager_avatar_url,
  md.name as manager_department_name,
  es.name as employment_status_name,
  es.category as employment_status_category,
  mes.name as manager_employment_status_name,
  case
    when app.latest_event_time is not null
    and app.clocked_out_at is not null
    and app.latest_event_time = app.clocked_out_at
    and (
      hw.scanned_at is null
      or app.latest_event_time > hw.scanned_at
    ) then 'Offline'::text
    when app.latest_event_time is not null
    and (
      hw.scanned_at is null
      or app.latest_event_time > hw.scanned_at
    ) then app.type_name
    when hw.scanned_at is not null then hw.scanner_location
    -- HR2000 leave ledger integration -- only replaces the terminal
    -- fallback (no app/hardware event today at all), never an actual
    -- observed activity above, so an employee on leave who still came in
    -- keeps their real status (e.g. 'Office').
    when lv.leave_type_codes is not null then 'On Leave (' || lv.leave_type_codes || ')'
    else 'Offline / Not Arrived'::text
  end as current_status,
  to_char(
    (
      GREATEST(app.latest_event_time, hw.scanned_at) AT TIME ZONE 'Asia/Kuala_Lumpur'::text
    ),
    'HH12:MI AM'::text
  ) as last_status_time,
  to_char(
    (
      LEAST(first_app.first_app_time, first_hw.first_hw_time) AT TIME ZONE 'Asia/Kuala_Lumpur'::text
    ),
    'HH12:MI AM'::text
  ) as first_arrival_time,
  app.id as current_attendance_id,
  app.attendance_type_id as current_attendance_type_id,
  -- HR2000 leave ledger integration -- appended at the end, not inserted
  -- earlier in the list: CREATE OR REPLACE VIEW only allows new columns to
  -- be added after every existing one (Postgres matches view columns
  -- positionally, so inserting mid-list looks like renaming an existing
  -- column and fails with error 42P16).
  (lv.leave_type_codes is not null) as is_on_leave_today,
  lv.leave_type_codes as leave_type_codes_today,
  -- Work location + structured personal address -- appended at the end,
  -- not inserted earlier, for the same positional reason as the leave
  -- columns above. Net-new: address_personal was never exposed on this
  -- view at all, unlike address_work. work_location_name is the real
  -- replacement for the now-frozen address_work column above.
  wl.name as work_location_name,
  wl.sub as work_location_code,
  pa.line1 as personal_address_line1,
  pa.line2 as personal_address_line2,
  pa.city as personal_address_city,
  pa.state as personal_address_state,
  pa.postcode as personal_address_postcode,
  pa.country as personal_address_country
from
  employees e
  left join profiles p on p.id = e.profile_id
  left join departments d on d.id = e.department_id
  left join employees m on m.id = e.manager_id
  left join profiles mp on mp.id = m.profile_id
  left join departments md on md.id = m.department_id
  left join employment_status es on es.id = e.employment_status_id
  left join employment_status mes on mes.id = m.employment_status_id
  left join nationalities n on n.id = e.nationality_id
  left join employment_type et on et.id = e.employment_type_id
  left join work_locations wl on wl.id = e.work_location_id
  left join addresses pa on pa.id = e.personal_address_id
  left join lateral (
    select
      a.id,
      a.attendance_type_id,
      at.name as type_name,
      a.clocked_in_at,
      a.clocked_out_at,
      GREATEST(
        a.clocked_in_at,
        COALESCE(
          a.clocked_out_at,
          '1970-01-01 00:00:00+00'::timestamp with time zone
        )
      ) as latest_event_time
    from
      attendance_activities a
      left join attendance_types at on a.attendance_type_id = at.id
    where
      a.employee_id = e.id
      and date (
        (
          a.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur'::text
        )
      ) = CURRENT_DATE
    order by
      (
        GREATEST(
          a.clocked_in_at,
          COALESCE(
            a.clocked_out_at,
            '1970-01-01 00:00:00+00'::timestamp with time zone
          )
        )
      ) desc
    limit
      1
  ) app on true
  left join lateral (
    select
      attendance_logs.scanner_location,
      attendance_logs.scanned_at
    from
      attendance_logs
    where
      attendance_logs.employee_id = e.employee_id
      and date (
        (
          attendance_logs.scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur'::text
        )
      ) = CURRENT_DATE
    order by
      attendance_logs.scanned_at desc
    limit
      1
  ) hw on true
  left join lateral (
    select
      min(attendance_activities.clocked_in_at) as first_app_time
    from
      attendance_activities
    where
      attendance_activities.employee_id = e.id
      and date (
        (
          attendance_activities.clocked_in_at AT TIME ZONE 'Asia/Kuala_Lumpur'::text
        )
      ) = CURRENT_DATE
  ) first_app on true
  left join lateral (
    select
      min(attendance_logs.scanned_at) as first_hw_time
    from
      attendance_logs
    where
      attendance_logs.employee_id = e.employee_id
      and date (
        (
          attendance_logs.scanned_at AT TIME ZONE 'Asia/Kuala_Lumpur'::text
        )
      ) = CURRENT_DATE
  ) first_hw on true
  -- HR2000 leave ledger integration -- "today" scope only, matching this
  -- view's own real-time-snapshot grain (unlike unified_daily_attendance,
  -- which is date-ranged).
  left join lateral (
    select
      string_agg(distinct lt.code, '+' order by lt.code) as leave_type_codes
    from
      leave_ledger_entries le
      join leave_ledger_types lt on lt.id = le.leave_type_id
    where
      le.employee_id = e.id
      and le.leave_date = current_date
  ) lv on true;