import { supabase } from "../../../../../lib/supabaseClient";
import { fetchEmployeesPublicByIds } from "../../../_shared/fetchEmployeesPublicByIds";

/**
 * Server-side search/filter/sort/paginate over the projects_with_progress
 * view (not the raw projects table) -- that view bakes in the precomputed
 * completed/total-non-cancelled progress % (req #9) as plain columns
 * (`select p.*, pp.*`), not a nested embed, so no PostgREST relationship
 * detection is needed for it. RLS on the underlying tables still applies
 * (the view is defined WITH (security_invoker = true)), so this naturally
 * only ever returns projects the caller is a member of.
 *
 * Deliberately NOT embedding `category:category_id(...)` here -- PostgREST's
 * embed syntax relies on detecting a real FK constraint on the queried
 * relation, which a VIEW doesn't carry even when its underlying SELECT
 * includes the FK column. category_id is resolved client-side against the
 * already-loaded (and already cached) category list instead -- see
 * tableConfig.jsx.
 *
 * `project_members` (for ProjectCard's avatar stack) IS fetched here, but
 * as a second, separate batched query against the real table -- one query
 * for the whole page's rosters, not one per card. Member identity
 * (name/avatar/department) is then resolved via employees_public, NOT a
 * nested `employees!project_members_employee_id_fkey(...)` embed -- see
 * fetchEmployeesPublicByIds.js's header comment for why (the raw
 * `employees` table's own RLS is HR-scoped, so embedding it directly for
 * an arbitrary fellow project member silently nulls out the embedded
 * object for anyone the viewer isn't HR-privileged to see).
 */
export async function fetchProjects({ page, pageSize, search, filters, sortBy, sortOrder }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("projects_with_progress")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    const map = {
      status: "status",
      category: "category_id",
    };

    if (map[key]) query = query.eq(map[key], value);
  });

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  const projects = data || [];

  if (!projects.length) {
    return { data: [], totalCount: count || 0 };
  }

  const { data: allMembers, error: membersError } = await supabase
    .from("project_members")
    .select("project_id, employee_id, role")
    .in(
      "project_id",
      projects.map((p) => p.id),
    );

  if (membersError) throw membersError;

  const employeesById = await fetchEmployeesPublicByIds((allMembers || []).map((m) => m.employee_id));
  const membersWithAvatars = (allMembers || []).map((m) => ({
    ...m,
    employee: employeesById.get(m.employee_id) ?? null,
  }));

  const membersByProject = new Map();
  membersWithAvatars.forEach((m) => {
    if (!membersByProject.has(m.project_id)) membersByProject.set(m.project_id, []);
    membersByProject.get(m.project_id).push(m);
  });

  return {
    data: projects.map((p) => ({ ...p, project_members: membersByProject.get(p.id) || [] })),
    totalCount: count || 0,
  };
}

/**
 * Single-project fetch for the project detail layout. Project + members
 * fetched in parallel, merged here rather than one embedded .select()
 * against the view -- for the same view-has-no-FK-to-detect reason as
 * fetchProjects above. project_members is queried directly against the
 * real table, giving the detail layout its member roster immediately
 * (needed for role-gated actions and the Tasks tab's assignee picker
 * options). Member identity is resolved via employees_public, NOT a
 * nested `employees!project_members_employee_id_fkey(...)` embed -- see
 * fetchEmployeesPublicByIds.js's header comment for why.
 */
export async function fetchProjectById(id) {
  const [{ data: project, error: projectError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase.from("projects_with_progress").select("*").eq("id", id).maybeSingle(),
      supabase.from("project_members").select("employee_id, role, added_at").eq("project_id", id),
    ]);

  if (projectError) throw projectError;
  if (!project) return null;
  if (membersError) throw membersError;

  const employeesById = await fetchEmployeesPublicByIds((members || []).map((m) => m.employee_id));
  const membersWithAvatars = (members || []).map((m) => ({
    ...m,
    employee: employeesById.get(m.employee_id) ?? null,
  }));

  return { ...project, project_members: membersWithAvatars };
}

/**
 * Lightweight, unpaginated {id, name} list of every project the caller is a
 * member of (RLS-scoped, same as fetchProjects) -- used purely to populate
 * a "Project" filter dropdown (e.g. the Workspace Documents page), not for
 * display of project details.
 */
export async function fetchAllProjectsLite() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

/**
 * Departments a project touches, derived live from its members' own
 * employees.department_id (req #2 -- explicitly NOT profiles.department_id,
 * which can drift from an employee's actual current department).
 */
export async function fetchProjectDepartments(projectId) {
  const { data, error } = await supabase
    .from("project_departments")
    .select("department_id, department_name, department_sub")
    .eq("project_id", projectId);

  if (error) throw error;

  return data || [];
}
