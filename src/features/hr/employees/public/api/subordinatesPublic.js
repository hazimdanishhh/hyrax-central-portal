import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchSubordinatesPublicById(employeeId) {
  if (!employeeId) return null;

  const { data, error } = await supabase
    .from("employees_public")
    .select("*")
    .eq("manager_id", employeeId)
    .in("employment_status_name", [
      "Active",
      "Terminated Notice",
      "On Leave",
      "Probation",
    ])
    .order("full_name");

  if (error) throw error;

  return data;
}
