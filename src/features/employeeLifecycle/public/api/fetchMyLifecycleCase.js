import { supabase } from "../../../../lib/supabaseClient";

/**
 * The caller's own OPEN case of the given type, for /app/employee/onboarding
 * and /app/employee/offboarding.
 *
 * MUST filter by employee_id client-side, not rely on RLS alone --
 * confirmed real bug (2026-09-02): this table's RLS has TWO permissive
 * SELECT policies ("Employee can view own visible case": employee_id =
 * current_employee_id() and employee_can_view = true; and "HR and IT can
 * view all lifecycle cases": no employee_id restriction at all), and
 * Postgres ORs multiple permissive policies together. Any caller who is
 * ALSO HR or IT department (a completely normal thing -- an HR/IT staff
 * member has their own onboarding too) matches the second, broader policy
 * and got EVERY open case company-wide back, not just their own --
 * `.maybeSingle()` then threw "multiple rows returned" for anyone in that
 * overlap, which the callers previously (silently, before the 2026-09-02
 * error-handling fix) rendered as a plain empty state. The explicit
 * `.eq("employee_id", employeeId)` below is what actually narrows the
 * result to "mine" -- RLS still independently enforces the caller is
 * ALLOWED to see that row (own case + visible / HR+IT), it was never a
 * substitute for asking for the right row in the first place.
 *
 * `employeeId` is required -- callers get it from `useEmployee()`
 * (EmployeeContext) and must not call this until it's resolved (see
 * useMyLifecycleCase.js's `enabled` gate).
 *
 * Item rows are equally RLS-gated (employee_visible = true only) -- a
 * client-side filter is NOT re-applied on top, since the offboarding
 * checklist's whole point is that non-visible items must never even reach
 * this code, not just be hidden by it. Item rows don't need the same
 * employee_id fix -- they're always fetched by `case_id`, already narrowed
 * to the one case resolved above.
 */
export async function fetchMyLifecycleCase(caseType, employeeId) {
  const { data: lifecycleCase, error: caseError } = await supabase
    .from("employee_lifecycle_cases_with_progress")
    .select("*")
    .eq("employee_id", employeeId)
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
