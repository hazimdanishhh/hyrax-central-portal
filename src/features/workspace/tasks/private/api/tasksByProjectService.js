import { supabase } from "../../../../../lib/supabaseClient";
import { fetchEmployeesPublicByIds } from "../../../_shared/fetchEmployeesPublicByIds";
import { fetchAllSupabaseRows } from "../../../../../functions/fetchAllSupabaseRows";

/**
 * Deliberately UNPAGINATED (no page/pageSize UI) -- mirrors useBillLines/
 * BillSidebar's "show everything" precedent, since the Tasks tab is meant to
 * be the complete view of a project's tasks (not a compact preview with a
 * "View All" link, like ClientSidebar's Leads section).
 *
 * "Unpaginated" doesn't mean unbounded, though -- uses fetchAllSupabaseRows
 * (added 2026-09, see its own header comment for the confirmed live Finance
 * bug that motivated it) to page through every matching row server-side
 * regardless of a project's real task count, rather than trusting a single
 * unbounded .select() to return everything. `id` is added as a final,
 * unique tie-breaker after the display-intended status/due_date ordering --
 * .range()-based pagination needs a fully deterministic order to avoid
 * skipping/duplicating rows across page boundaries when many tasks share
 * the same status+due_date.
 */
export async function fetchTasksByProject(projectId) {
  const data = await fetchAllSupabaseRows(() =>
    supabase
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
      // no CASE expression needed. `id` tie-breaks for deterministic paging.
      .order("status", { ascending: true })
      .order("due_date", { ascending: true })
      .order("id", { ascending: true }),
  );

  const tasks = data;

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
