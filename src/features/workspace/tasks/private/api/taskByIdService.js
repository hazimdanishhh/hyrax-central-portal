import { supabase } from "../../../../../lib/supabaseClient";
import { attachEmployeeAvatars } from "../../../_shared/attachEmployeeAvatars";

/**
 * Single-task fetch, independent of fetchMyTasks' pagination -- backs a
 * direct/shared/notification link to a task that may not be on the
 * viewer's currently-loaded page (see MyTasks.jsx's useMemo fallback,
 * mirroring useLead(leadId)'s exact role in LeadsManagement.jsx). RLS
 * naturally returns null for a task the caller isn't a project member of
 * -- no special "unauthorized" branch needed, same as fetchProjectById.
 */
export async function fetchTaskById(taskId) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      project:projects (id, name),
      task_assignees (
        employee_id,
        employee:employees!task_assignees_employee_id_fkey (id, full_name, profile_id)
      )
    `,
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const employeesWithAvatars = await attachEmployeeAvatars((data.task_assignees ?? []).map((a) => a.employee));

  return {
    ...data,
    task_assignees: (data.task_assignees ?? []).map((a, i) => ({ ...a, employee: employeesWithAvatars[i] })),
  };
}
