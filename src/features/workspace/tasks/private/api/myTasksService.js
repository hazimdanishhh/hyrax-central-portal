import { supabase } from "../../../../../lib/supabaseClient";
import { attachEmployeeAvatars } from "../../../_shared/attachEmployeeAvatars";

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
 */
export async function fetchMyTasks({ employeeId, page, pageSize, search, filters, sortBy, sortOrder }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tasks")
    .select(
      `
      *,
      project:projects (id, name),
      task_assignees!inner (employee_id)
    `,
      { count: "exact" },
    )
    .eq("task_assignees.employee_id", employeeId)
    .order(sortBy, { ascending: sortOrder === "ascending" });

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
    .select(
      `
      task_id,
      employee_id,
      employee:employees!task_assignees_employee_id_fkey (id, full_name, profile_id)
    `,
    )
    .in(
      "task_id",
      tasks.map((t) => t.id),
    );

  if (assigneesError) throw assigneesError;

  const employeesWithAvatars = await attachEmployeeAvatars((allAssignees || []).map((a) => a.employee));
  const assigneesWithAvatars = (allAssignees || []).map((a, i) => ({ ...a, employee: employeesWithAvatars[i] }));

  const assigneesByTask = new Map();
  assigneesWithAvatars.forEach((a) => {
    if (!assigneesByTask.has(a.task_id)) assigneesByTask.set(a.task_id, []);
    assigneesByTask.get(a.task_id).push(a);
  });

  return {
    data: tasks.map((t) => ({ ...t, task_assignees: assigneesByTask.get(t.id) || [] })),
    totalCount: count || 0,
  };
}
