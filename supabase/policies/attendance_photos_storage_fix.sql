-- Run this once in the Supabase SQL editor.
--
-- Confirmed live via a full pg_policies audit (2026-09): the "attendance"
-- bucket's 4 policies (Studio-auto-named "Give users authenticated access to
-- folder vdno4p_0/1/2/3", one each for SELECT/INSERT/UPDATE/DELETE) check
-- only bucket_id = 'attendance' and foldername[1] = 'photos' and
-- auth.role() = 'authenticated' -- no per-employee or per-department scoping
-- at all. Compare with the very next policy on the same table, "Avatars:
-- own file or superadmin", which correctly restricts to the file's own
-- owner or superadmin.
--
-- uploadAttendancePhoto.js writes to
-- photos/${employeeId}/${year}/${month}/${fileName}, where employeeId is
-- employees.id (the uuid PK, passed as data.employee_id from
-- AttendanceManagement.jsx -- the same FK shape as every other
-- employee_id column in this schema, e.g. attendance_activities.employee_id/
-- leave_ledger_entries.employee_id). As deployed, any authenticated user in
-- any department can read, overwrite, or delete any other employee's
-- clock-in/out photo via the storage API directly -- broader than any real
-- consumer needs (only HR's Attendance Management page and the employee
-- viewing their own record ever touch these), and undermines the photos'
-- use as attendance/anti-fraud evidence.
--
-- Idempotent: safe to re-run.

drop policy if exists "Give users authenticated access to folder vdno4p_0" on storage.objects;
drop policy if exists "Give users authenticated access to folder vdno4p_1" on storage.objects;
drop policy if exists "Give users authenticated access to folder vdno4p_2" on storage.objects;
drop policy if exists "Give users authenticated access to folder vdno4p_3" on storage.objects;
drop policy if exists "Attendance photos: HR, self, or superadmin" on storage.objects;

create policy "Attendance photos: HR, self, or superadmin" on storage.objects
for all to authenticated
using (
  bucket_id = 'attendance'
  and (storage.foldername(name))[1] = 'photos'
  and (
    is_superadmin()
    or is_department('HR')
    or (storage.foldername(name))[2] = (
      select employees.id::text from employees where employees.profile_id = auth.uid()
    )
  )
) with check (
  bucket_id = 'attendance'
  and (storage.foldername(name))[1] = 'photos'
  and (
    is_superadmin()
    or is_department('HR')
    or (storage.foldername(name))[2] = (
      select employees.id::text from employees where employees.profile_id = auth.uid()
    )
  )
);
