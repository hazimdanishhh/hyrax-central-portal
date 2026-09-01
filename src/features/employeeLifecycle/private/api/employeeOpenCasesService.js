import { supabase } from "../../../../lib/supabaseClient";

/**
 * All of one employee's OPEN lifecycle cases (zero, one, or -- since
 * simultaneous onboarding+offboarding is real, confirmed via actual
 * employee data, not a hypothetical -- genuinely two), with progress
 * counts. Backs EmployeeLifecycleCaseSummary (the HR Employee Management
 * sidebar integration) and the table/card badge columns. A separate,
 * richer query from lifecycleCasesService.js's list fetch -- this one is
 * called once per opened employee sidebar, not once per page load, so the
 * per-item aggregation cost is fine here in a way it wouldn't be paying it
 * for every row of a 20-row list.
 */
export async function fetchOpenCasesForEmployee(employeeId) {
  if (!employeeId) return [];

  const { data, error } = await supabase
    .from("employee_lifecycle_cases_with_progress")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "OPEN");

  if (error) throw error;

  return data || [];
}
