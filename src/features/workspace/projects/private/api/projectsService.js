import { supabase } from "../../../../../lib/supabaseClient";
import { attachEmployeeAvatars } from "../../../_shared/attachEmployeeAvatars";

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
 * for the whole page's rosters, not one per card -- since that table (unlike
 * the view above) carries a real FK PostgREST could embed through, but
 * batching across many project ids in one .in() call is simpler and just
 * as safe either way.
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
    .select(
      `
      project_id,
      employee_id,
      role,
      employee:employees!project_members_employee_id_fkey (id, full_name, profile_id, department_id, department:departments(id, name, sub))
    `,
    )
    .in(
      "project_id",
      projects.map((p) => p.id),
    );

  if (membersError) throw membersError;

  const employeesWithAvatars = await attachEmployeeAvatars((allMembers || []).map((m) => m.employee));
  const membersWithAvatars = (allMembers || []).map((m, i) => ({ ...m, employee: employeesWithAvatars[i] }));

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
 * real table (which DOES have a real FK to employees for PostgREST to
 * embed through), giving the detail layout its member roster immediately
 * (needed for role-gated actions and the Tasks tab's assignee picker
 * options). A third pass, attachEmployeeAvatars, fills in each member's
 * avatar_url from profiles (see that file's own header comment for why
 * that's a separate plain query, not a nested embed).
 */
export async function fetchProjectById(id) {
  const [{ data: project, error: projectError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase.from("projects_with_progress").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("project_members")
        .select(
          `
          employee_id,
          role,
          added_at,
          employee:employees!project_members_employee_id_fkey (id, full_name, profile_id, department_id, department:departments(id, name, sub))
        `,
        )
        .eq("project_id", id),
    ]);

  if (projectError) throw projectError;
  if (!project) return null;
  if (membersError) throw membersError;

  const employeesWithAvatars = await attachEmployeeAvatars((members || []).map((m) => m.employee));
  const membersWithAvatars = (members || []).map((m, i) => ({ ...m, employee: employeesWithAvatars[i] }));

  return { ...project, project_members: membersWithAvatars };
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
