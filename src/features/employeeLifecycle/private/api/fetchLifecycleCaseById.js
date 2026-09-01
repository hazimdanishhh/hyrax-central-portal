import { supabase } from "../../../../lib/supabaseClient";
import { fetchEmployeesPublicByIds } from "../fetchEmployeesPublicByIds";

/**
 * One case (with progress) + its full item list + the employee, for
 * LifecycleCaseDetail -- the one shared component every hr/it/onboarding|
 * offboarding route mounts. Case + items fetched in parallel, matching
 * fetchProjectById's own case+members-in-parallel shape.
 *
 * confirmation_due_date is pulled in via a second, separate employees
 * query (HR-scoped RLS, so IT viewers simply get null back here -- fine,
 * it only backs the "Probation review due" read-only line on a completed
 * ONBOARDING case, never rendered for an IT-only viewer's own concerns).
 */
export async function fetchLifecycleCaseById(caseId) {
  const [{ data: lifecycleCase, error: caseError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase.from("employee_lifecycle_cases_with_progress").select("*").eq("id", caseId).maybeSingle(),
      supabase
        .from("employee_lifecycle_case_items")
        .select("*")
        .eq("case_id", caseId),
    ]);

  if (caseError) throw caseError;
  if (!lifecycleCase) return null;
  if (itemsError) throw itemsError;

  const employeesById = await fetchEmployeesPublicByIds([lifecycleCase.employee_id]);
  const employee = employeesById.get(lifecycleCase.employee_id) ?? null;

  let confirmationDueDate = null;
  if (lifecycleCase.case_type === "ONBOARDING" && lifecycleCase.status === "COMPLETED") {
    const { data: employeeRow } = await supabase
      .from("employees")
      .select("confirmation_date, join_date")
      .eq("id", lifecycleCase.employee_id)
      .maybeSingle();

    if (employeeRow && !employeeRow.confirmation_date && employeeRow.join_date) {
      const due = new Date(employeeRow.join_date);
      due.setMonth(due.getMonth() + 6);
      confirmationDueDate = due.toISOString().slice(0, 10);
    }
  }

  return {
    ...lifecycleCase,
    employee,
    items: items || [],
    confirmationDueDate,
  };
}
