import { supabase } from "../../lib/supabaseClient";

export async function fetchAttendanceActivitiesMetadata() {
  const [employees, departments, attendanceTypes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, employee_id")
      .order("full_name"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("attendance_types").select("*").order("name"),
  ]);

  return {
    employees: employees.data || [],
    departments: departments.data || [],
    attendanceTypes: attendanceTypes.data || [],
  };
}
