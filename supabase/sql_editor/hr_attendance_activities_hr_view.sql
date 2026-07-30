create view public.attendance_activities_hr_view
with
  (security_invoker = on) as
select
  aa.id,
  aa.employee_id,
  e.full_name as employee_name,
  e.employee_id as employee_code,
  e.department_id,
  d.name as department_name,
  e."position" as employee_position,
  at.id as attendance_type_id,
  at.name as attendance_type_name,
  aa.clocked_in_at,
  aa.clocked_out_at,
  aa.notes,
  aa.location,
  aa.photo_url,
  aa.approval_status,
  aa.approved_by,
  ap.full_name as approved_by_name,
  aa.approved_at,
  aa.rejection_reason,
  aa.created_at,
  p.avatar_url,
  e.preferred_name as employee_preferred_name
from
  attendance_activities aa
  left join employees e on e.id = aa.employee_id
  left join profiles p on p.id = e.profile_id
  left join departments d on d.id = e.department_id
  left join attendance_types at on at.id = aa.attendance_type_id
  left join employees ap on ap.id = aa.approved_by;