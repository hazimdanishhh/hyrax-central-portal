import { supabase } from "../../../../../lib/supabaseClient";

export async function getEmployeePublicById(employeeId) {
  if (!employeeId) return null;

  const { data, error } = await supabase
    .from("employees_public")
    .select("*")
    .eq("id", employeeId)
    .single();

  if (error) throw error;

  return data;
}
