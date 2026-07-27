import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Search employees for async select -- mirrors clientSearch.js.
 */
export async function searchEmployees(search = "") {
  let query = supabase
    .from("employees")
    .select("id, full_name")
    .order("full_name")
    .limit(20);

  if (search?.trim()) {
    query = query.ilike("full_name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((employee) => ({
    value: employee.id,
    label: employee.full_name,
  }));
}

/**
 * Get employee by id for async select filter
 */
export async function getEmployeeById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    label: data.full_name,
    value: data.id,
  };
}
