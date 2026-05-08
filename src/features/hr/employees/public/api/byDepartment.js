import { supabase } from "../../../../../lib/supabaseClient";

export async function getDepartmentEmployeesPublicById(departmentId) {
  if (!departmentId) return null;

  const { data, error } = await supabase
    .from("employees_public")
    .select("*")
    .eq("department_id", departmentId)
    .order("full_name");

  if (error) throw error;

  return data;
}
