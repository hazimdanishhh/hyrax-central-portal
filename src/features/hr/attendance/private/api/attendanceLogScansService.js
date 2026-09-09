// features/hr/attendance/private/api/attendanceLogScansService.js

import { supabase } from "@/lib/supabaseClient";

// Backs the "click an Office/Blending Plant timeline card to see the
// underlying raw scans" feature. Calls get_attendance_log_scans (plain,
// not SECURITY DEFINER -- runs as the calling user, so
// attendance_logs_crud.sql's RLS policies apply exactly as they would to a
// direct query).
export async function fetchAttendanceLogScans({
  employeeCode,
  scannerLocation,
  workDate,
}) {
  if (!employeeCode || !scannerLocation || !workDate) return [];

  const { data, error } = await supabase.rpc("get_attendance_log_scans", {
    p_employee_code: employeeCode,
    p_scanner_location: scannerLocation,
    p_work_date: workDate,
  });

  if (error) throw error;

  return data || [];
}
