/**
 * Pure predicate, no hook -- no state involved, just a check over
 * already-fetched data. Reused identically by the Tasks tab (row-level
 * edit gating), My Tasks (always true there, kept for one consistent
 * mental model), and the task edit sidebar's `cannotUpdate`.
 *
 * Not a security boundary -- RLS's "Assignees can update their tasks"
 * policy (tasks_crud.sql) is what actually enforces req #6; this is UX
 * only.
 */
export function isTaskAssignee(task, employeeId) {
  if (!task || !employeeId) return false;
  return (task.task_assignees ?? []).some((a) => a.employee_id === employeeId);
}
