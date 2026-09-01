import { supabase } from "../../../../lib/supabaseClient";

/**
 * The caller's own OPEN case of the given type, for /app/employee/onboarding
 * and /app/employee/offboarding. Deliberately does NOT filter by
 * employee_id client-side -- RLS ("Employee can view own visible case":
 * employee_id = current_employee_id() and employee_can_view = true) already
 * restricts this to the caller's own case, and only once employee_can_view
 * is true, so a query for an offboarding case HR hasn't yet made visible
 * simply returns zero rows here, not an error -- the correct "nothing to
 * show yet" result, same pattern ProjectDetailLayout.jsx relies on for "you
 * aren't a member of this project."
 *
 * Item rows are equally RLS-gated (employee_visible = true only) -- a
 * client-side filter is NOT re-applied on top, since the offboarding
 * checklist's whole point is that non-visible items must never even reach
 * this code, not just be hidden by it.
 */
export async function fetchMyLifecycleCase(caseType) {
  const { data: lifecycleCase, error: caseError } = await supabase
    .from("employee_lifecycle_cases_with_progress")
    .select("*")
    .eq("case_type", caseType)
    .eq("status", "OPEN")
    .maybeSingle();

  if (caseError) throw caseError;
  if (!lifecycleCase) return null;

  const { data: items, error: itemsError } = await supabase
    .from("employee_lifecycle_case_items")
    .select("*")
    .eq("case_id", lifecycleCase.id);

  if (itemsError) throw itemsError;

  return { ...lifecycleCase, items: items || [] };
}
