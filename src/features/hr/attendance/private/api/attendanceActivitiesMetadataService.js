import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchAttendanceActivitiesMetadata() {
  const [employees, departments, attendanceTypes, workLocations] =
    await Promise.all([
      // work_location_id drives the backfill wizard's per-employee default
      // clock-out time (KL 17:00 vs Meru 17:30), so the two can't be resolved
      // without it. Fetched here rather than in a second query because every
      // consumer of this hook already pays for this round trip.
      supabase
        .from("employees")
        .select("id, full_name, employee_id, work_location_id")
        .order("full_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("attendance_types").select("*").order("name"),
      supabase.from("work_locations").select("*").order("name"),
    ]);

  return {
    employees: employees.data || [],
    departments: departments.data || [],
    attendanceTypes: attendanceTypes.data || [],
    workLocations: workLocations.data || [],
  };
}
