import { supabase } from "../../../../../lib/supabaseClient";
import { attachEmployeeAvatars } from "../../../_shared/attachEmployeeAvatars";

/**
 * Deliberately UNPAGINATED -- mirrors useBillLines/BillSidebar's
 * "show everything" precedent, since the Tasks tab is meant to be the
 * complete view of a project's tasks (not a compact preview with a
 * "View All" link, like ClientSidebar's Leads section). Revisit with real
 * pagination if a project could plausibly reach hundreds of tasks.
 */
export async function fetchTasksByProject(projectId) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      task_assignees (
        employee_id,
        employee:employees!task_assignees_employee_id_fkey (id, full_name, profile_id)
      )
    `,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const tasks = data || [];

  // Flatten every assignee across every task into one batch so avatars are
  // fetched in a single query, not one per task -- then re-zip by index
  // (attachEmployeeAvatars preserves order/length 1:1).
  const allAssigneeEmployees = tasks.flatMap((t) => (t.task_assignees ?? []).map((a) => a.employee));
  const employeesWithAvatars = await attachEmployeeAvatars(allAssigneeEmployees);

  let cursor = 0;
  return tasks.map((t) => ({
    ...t,
    task_assignees: (t.task_assignees ?? []).map((a) => ({
      ...a,
      employee: employeesWithAvatars[cursor++],
    })),
  }));
}
