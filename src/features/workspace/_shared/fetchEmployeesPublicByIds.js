import { supabase } from "../../../lib/supabaseClient";

/**
 * Resolves a batch of employee ids to their employees_public row --
 * REPLACES both the old nested `employees!<fk>(...)` embed AND the
 * separate attachEmployeeAvatars() pass this module used to do.
 *
 * Why: the raw `employees` table's own RLS is HR-scoped (self/manager/HR/
 * superadmin -- no policy file for it exists in this repo, it was set up
 * directly in Supabase Studio, but every other symptom points the same
 * way: employees_public exists specifically because the raw table isn't
 * safe/intended for broad reads). A task assignee or project member the
 * VIEWER isn't HR-privileged to see resolves that embed to `null` --
 * PostgREST doesn't error, it just nulls the relation -- which crashed
 * EmployeeImage.jsx (read `employee.avatar_url` unconditionally) the
 * moment a real test user (not superadmin/HR/that person's manager)
 * opened a task assigned to someone else.
 *
 * Every project member needs to see every other member's basic identity
 * regardless of HR relationship (req #6) -- `employees_public` is this
 * app's existing, already-broadly-readable mechanism for exactly that
 * (see useAllEmployeesPublic.js's identical precedent), and it already
 * carries `avatar_url` pre-joined from `profiles` and `department_name`
 * pre-joined from `departments`, so one query here replaces both the old
 * embed and the old attachEmployeeAvatars() call.
 *
 * A view has no FK for PostgREST to embed through (same reason
 * projects_with_progress can't be embedded into either) -- this is a
 * plain batched query, not a nested `.select()`. Returns a Map keyed by
 * employee id; callers zip it back into whatever parent shape they had
 * (a task_assignees row, a project_members row, etc), falling back to
 * `null` for any id that still doesn't resolve (belt-and-suspenders --
 * EmployeeImage.jsx also tolerates a null `employee` now).
 */
export async function fetchEmployeesPublicByIds(employeeIds) {
  const ids = [...new Set((employeeIds || []).filter(Boolean))];

  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("employees_public")
    .select("id, full_name, avatar_url, department_id, department_name")
    .in("id", ids);

  if (error) throw error;

  return new Map((data || []).map((e) => [e.id, e]));
}
