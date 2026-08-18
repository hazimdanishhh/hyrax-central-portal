import { supabase } from "../../../../../lib/supabaseClient";
import { fetchEmployeesPublicByIds } from "../../../_shared/fetchEmployeesPublicByIds";

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
        employee_id
      ),
      task_documents (
        document_id,
        document:documents (id, drive_file_id, name, url, mime_type, icon_url)
      )
    `,
    )
    .eq("project_id", projectId)
    // Same status-primary, due_date-secondary ordering as myTasksService.js
    // -- was created_at here before, a less useful key than due date for a
    // task list; task_status's enum declaration order (TO_DO, IN_PROGRESS,
    // COMPLETED, CANCELLED) already sorts to-do-first, cancelled-last with
    // no CASE expression needed.
    .order("status", { ascending: true })
    .order("due_date", { ascending: true });

  if (error) throw error;

  const tasks = data || [];

  // Batch-resolve every assignee across every task in one query, then
  // re-zip by id -- see fetchEmployeesPublicByIds.js's header comment for
  // why this is a plain query against employees_public, not a nested
  // `employees!task_assignees_employee_id_fkey(...)` embed.
  const employeesById = await fetchEmployeesPublicByIds(
    tasks.flatMap((t) => (t.task_assignees ?? []).map((a) => a.employee_id)),
  );

  return tasks.map((t) => ({
    ...t,
    task_assignees: (t.task_assignees ?? []).map((a) => ({
      ...a,
      employee: employeesById.get(a.employee_id) ?? null,
    })),
  }));
}
