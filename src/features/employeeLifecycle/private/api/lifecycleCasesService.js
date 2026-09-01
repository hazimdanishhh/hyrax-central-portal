import { supabase } from "../../../../lib/supabaseClient";
import { fetchEmployeesPublicByIds } from "../fetchEmployeesPublicByIds";

/**
 * Full, unlimited list of one case_type's cases (mirrors ProjectTasksTab's
 * own "deliberately unpaginated... revisit if this could plausibly reach
 * hundreds" precedent) -- open lifecycle cases at any one company are
 * inherently a small, bounded set, so a real usePaginatedQuery server-side
 * page/search/sort round trip would be solving a problem this feature
 * doesn't have. LifecycleCaseList does its own client-side search/status
 * filtering over the result, same as ProjectTasksTab does over its tasks.
 *
 * Queries employee_lifecycle_cases_with_progress (not the raw table) for
 * the precomputed completed/total item counts (see
 * employee_lifecycle_cases_views.sql) -- RLS on the underlying tables
 * still applies (security_invoker = true), so this naturally only returns
 * cases the caller's department (HR/IT) or superadmin status permits.
 *
 * Employee identity is resolved via employees_public, not a nested
 * `employee:employee_id(...)` embed -- the view has no FK for PostgREST to
 * detect, and the raw employees table's RLS wouldn't let an IT viewer see
 * it directly anyway. See fetchEmployeesPublicByIds.js's own header.
 */
export async function fetchLifecycleCases(caseType) {
  const { data: cases, error } = await supabase
    .from("employee_lifecycle_cases_with_progress")
    .select("*")
    .eq("case_type", caseType)
    .order("opened_at", { ascending: false });

  if (error) throw error;

  const rows = cases || [];
  if (!rows.length) return [];

  const employeesById = await fetchEmployeesPublicByIds(rows.map((c) => c.employee_id));

  return rows.map((c) => ({ ...c, employee: employeesById.get(c.employee_id) ?? null }));
}
