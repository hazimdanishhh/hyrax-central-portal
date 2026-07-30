create view public.employees_public as
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
  m.address_work as manager_address_work,
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
  app.attendance_type_id as current_attendance_type_id
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
  ) first_hw on true;