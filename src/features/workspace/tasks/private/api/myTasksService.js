import { supabase } from "../../../../../lib/supabaseClient";
import { fetchEmployeesPublicByIds } from "../../../_shared/fetchEmployeesPublicByIds";

/**
 * Cross-project, real pagination -- unlike tasksByProjectService.js (scoped
 * to one project, unpaginated), this grows over an employee's whole
 * tenure. Uses the `!inner` embed-filter pattern this codebase already
 * uses elsewhere (employeesService.js's employment_status_id!inner) to
 * make the task_assignees join actually RESTRICT rows, not just decorate
 * them -- a plain (non-inner) embed would return every task regardless of
 * assignment and just null out the nested object for non-matches.
 *
 * That same filtered embed also narrows the RETURNED task_assignees array
 * down to only the matching (current-employee) row, not every assignee on
 * the task -- correct for restricting/paginating, wrong for display
 * (TaskCard wants to show everyone working the task, not just "you"). A
 * second batched query (by task id, not one per task) fetches the real
 * full roster and overwrites task_assignees on each row before returning
 * -- same "restrict with one query, display with a second" split already
 * used in fetchProjects for its member-avatar stack.
 *
 * Order is hardcoded to due_date ascending -- My Tasks' sort control was
 * removed (it should always read "what's due soonest"), and that has to be
 * enforced here, not just by omitting the UI, or a stale/bookmarked URL
 * with a leftover ?sortBy=... would still reach this function via
 * usePaginatedQuery's URL-param passthrough and silently change the order.
 */
export async function fetchMyTasks({ employeeId, page, pageSize, search, filters }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tasks")
    .select(
      `
      *,
      project:projects (id, name),
      task_assignees!inner (employee_id),
      task_documents (
        document_id,
        document:documents (id, drive_file_id, name, url, mime_type, icon_url)
      )
    `,
      { count: "exact" },
    )
    .eq("task_assignees.employee_id", employeeId)
    // status primary (task_status enum was declared TO_DO, IN_PROGRESS,
    // COMPLETED, CANCELLED -- Postgres enums sort by that declaration
    // order by default, already matching the desired to-do-first,
    // cancelled-last grouping with no CASE expression needed), due_date
    // as the tie-breaker within each status group.
    .order("status", { ascending: true })
    .order("due_date", { ascending: true });

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    const map = {
      status: "status",
      project: "project_id",
    };

    if (map[key]) query = query.eq(map[key], value);
  });

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  const tasks = data || [];

  if (!tasks.length) {
    return { data: [], totalCount: count || 0 };
  }

  const { data: allAssignees, error: assigneesError } = await supabase
    .from("task_assignees")
    .select("task_id, employee_id")
    .in(
      "task_id",
      tasks.map((t) => t.id),
    );

  if (assigneesError) throw assigneesError;

  // See fetchEmployeesPublicByIds.js's header comment for why this is a
  // plain query against employees_public, not a nested
  // `employees!task_assignees_employee_id_fkey(...)` embed.
  const employeesById = await fetchEmployeesPublicByIds((allAssignees || []).map((a) => a.employee_id));

  const assigneesByTask = new Map();
  (allAssignees || []).forEach((a) => {
    if (!assigneesByTask.has(a.task_id)) assigneesByTask.set(a.task_id, []);
    assigneesByTask.get(a.task_id).push({ ...a, employee: employeesById.get(a.employee_id) ?? null });
  });

  return {
    data: tasks.map((t) => ({ ...t, task_assignees: assigneesByTask.get(t.id) || [] })),
    totalCount: count || 0,
  };
}

/**
 * Lightweight "last N tasks assigned to me, newest first" fetch for the home
 * dashboard's Recent Tasks widget -- unlike fetchMyTasks above, this is
 * flat/unpaginated and ordered by created_at, not the fixed
 * status-then-due_date ordering My Tasks itself always uses (that ordering
 * suits "what's urgent", not "what's recent"). Same restrict-with-one-query,
 * display-the-full-roster-with-a-second split as fetchMyTasks, for the same
 * reason -- task_assignees!inner narrows the returned array down to just the
 * matching employee, wrong for TaskCard's display of every assignee.
 */
export async function fetchRecentTasks(employeeId, limit = 5) {
  if (!employeeId) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      project:projects (id, name),
      task_assignees!inner (employee_id)
    `,
    )
    .eq("task_assignees.employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const tasks = data || [];

  if (!tasks.length) {
    return [];
  }

  const { data: allAssignees, error: assigneesError } = await supabase
    .from("task_assignees")
    .select("task_id, employee_id")
    .in(
      "task_id",
      tasks.map((t) => t.id),
    );

  if (assigneesError) throw assigneesError;

  const employeesById = await fetchEmployeesPublicByIds((allAssignees || []).map((a) => a.employee_id));

  const assigneesByTask = new Map();
  (allAssignees || []).forEach((a) => {
    if (!assigneesByTask.has(a.task_id)) assigneesByTask.set(a.task_id, []);
    assigneesByTask.get(a.task_id).push({ ...a, employee: employeesById.get(a.employee_id) ?? null });
  });

  return tasks.map((t) => ({ ...t, task_assignees: assigneesByTask.get(t.id) || [] }));
}
