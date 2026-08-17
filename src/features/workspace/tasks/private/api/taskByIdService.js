import { supabase } from "../../../../../lib/supabaseClient";
import { fetchEmployeesPublicByIds } from "../../../_shared/fetchEmployeesPublicByIds";

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
        employee_id
      ),
      task_documents (
        document_id,
        document:documents (id, drive_file_id, name, url, mime_type, icon_url)
      )
    `,
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // See fetchEmployeesPublicByIds.js's header comment for why this is a
  // plain query against employees_public, not a nested
  // `employees!task_assignees_employee_id_fkey(...)` embed.
  const employeesById = await fetchEmployeesPublicByIds((data.task_assignees ?? []).map((a) => a.employee_id));

  return {
    ...data,
    task_assignees: (data.task_assignees ?? []).map((a) => ({
      ...a,
      employee: employeesById.get(a.employee_id) ?? null,
    })),
  };
}
