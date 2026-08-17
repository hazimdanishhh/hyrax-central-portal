import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Same diff-and-sync shape as projectMembersMutations.js's
 * syncProjectMembers -- a multi-select field's array value can't be
 * expressed as a plain column update against a junction table.
 *
 * The DB enforces req #5 (assignee must already be a WORKING project
 * member, never cc) via enforce_task_assignee_is_project_member.sql's
 * trigger regardless of what this function sends -- the UI additionally
 * scopes the picker's options to the project's own working members only,
 * so a rejection here should be rare, not the primary guardrail.
 */
export async function syncTaskAssignees(taskId, employeeIds) {
  const { data: current, error: fetchError } = await supabase
    .from("task_assignees")
    .select("employee_id")
    .eq("task_id", taskId);

  if (fetchError) throw fetchError;

  const currentIds = new Set(current.map((a) => a.employee_id));
  const nextIds = new Set(employeeIds);

  const toAdd = employeeIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length) {
    const { error } = await supabase
      .from("task_assignees")
      .insert(toAdd.map((employee_id) => ({ task_id: taskId, employee_id })));
    if (error) throw error;
  }

  if (toRemove.length) {
    const { error } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId)
      .in("employee_id", toRemove);
    if (error) throw error;
  }
}
