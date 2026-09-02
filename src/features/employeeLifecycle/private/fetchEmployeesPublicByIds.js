import { supabase } from "../../../lib/supabaseClient";

/**
 * Resolves a batch of employee ids to their employees_public row -- this
 * module is read by both HR and IT viewers, and the raw `employees`
 * table's own RLS is HR-scoped (self/manager/HR/superadmin only), so an
 * IT viewer embedding `employee:employee_id(...)` directly against
 * `employees` would silently get `null`. employees_public is this app's
 * existing broadly-readable directory view, already carrying `avatar_url`/
 * `department_name` pre-joined -- same precedent as
 * src/features/workspace/_shared/fetchEmployeesPublicByIds.js (duplicated
 * here, not cross-imported, matching this repo's per-domain module
 * boundary convention).
 *
 * employee_lifecycle_cases_with_progress has no FK for PostgREST to embed
 * through (a view, same reason projects_with_progress can't be embedded
 * into either) -- this is a plain batched query, callers zip the result
 * back onto their case rows client-side.
 */
export async function fetchEmployeesPublicByIds(employeeIds) {
  const ids = [...new Set((employeeIds || []).filter(Boolean))];

  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("employees_public")
    .select("id, full_name, avatar_url, department_id, department_name, profile_id")
    .in("id", ids);

  if (error) throw error;

  return new Map((data || []).map((e) => [e.id, e]));
}
