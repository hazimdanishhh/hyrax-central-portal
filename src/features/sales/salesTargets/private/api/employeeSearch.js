import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Search employees for async select -- mirrors clientSearch.js.
 *
 * Queries employees_public, not employees: the raw table's RLS is HR-scoped
 * (self/manager/HR/superadmin), but this picker is used by Sales/MGM
 * managers (salesRepMapping, salesTargets), who'd get zero rows back
 * against the raw table. See fetchEmployeesPublicByIds.js for the same
 * fix applied to embedded joins elsewhere in the app.
 */
export async function searchEmployees(search = "") {
  let query = supabase
    .from("employees_public")
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
    .from("employees_public")
    .select("id, full_name")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    label: data.full_name,
    value: data.id,
  };
}
