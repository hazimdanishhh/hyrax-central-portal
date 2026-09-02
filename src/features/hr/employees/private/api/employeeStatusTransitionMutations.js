import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Applies a guided employment-status transition (Begin Offboarding,
 * Immediate Termination, Finalize Departure -- see
 * src/features/hr/employees/private/employeeStatusTransitions.js) and,
 * when an expected last day was collected, writes it directly onto the
 * resulting OFFBOARDING case -- not into employees.end_date/resignation_date.
 * See docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md Part 2: those two
 * columns stay untouched by this guided flow (end_date is reserved for
 * non-full-time/contract employment with a pre-known scheduled end;
 * resignation_date's real-world meaning is undocumented anywhere in this
 * codebase, confirmed by direct research -- decoupling this flow from both
 * is the actual fix, not a new definition for either).
 *
 * The employees UPDATE is what fires handle_employee_offboarding_case_open.sql
 * (a database trigger, same transaction) -- by the time this function's own
 * update call resolves, the case already exists if one was going to be
 * opened. The case's expected_last_day is then set as a deliberate,
 * separate follow-up call (not atomic with the trigger, which is fine --
 * this is a same-user, same-flow, sub-second follow-up, not a
 * long-running gap), rather than trying to pass expected_last_day through
 * the trigger itself, which would require a new mechanism (e.g. a
 * session variable) for no real benefit.
 */
export async function applyEmployeeStatusTransition({
  employeeId,
  employmentStatusId,
  terminationReasonId,
  expectedLastDay,
}) {
  const { data: employee, error: updateError } = await supabase
    .from("employees")
    .update({
      employment_status_id: employmentStatusId,
      termination_reason_id: terminationReasonId ?? null,
    })
    .eq("id", employeeId)
    .select("*")
    .single();

  if (updateError) throw updateError;

  if (expectedLastDay) {
    const { data: openCase, error: caseError } = await supabase
      .from("employee_lifecycle_cases")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("case_type", "OFFBOARDING")
      .eq("status", "OPEN")
      .maybeSingle();

    if (caseError) throw caseError;

    // A null openCase here (transition didn't actually open/match an
    // offboarding trigger condition) is a real possibility -- e.g.
    // Finalize Departure moving a case to a terminal status doesn't open a
    // NEW case, it's expected to already exist. Only write expected_last_day
    // when there's a genuinely open case to attach it to.
    if (openCase) {
      const { error: caseUpdateError } = await supabase
        .from("employee_lifecycle_cases")
        .update({ expected_last_day: expectedLastDay })
        .eq("id", openCase.id);

      if (caseUpdateError) throw caseUpdateError;
    }
  }

  return employee;
}
