import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Cross-project, real pagination over documents_with_context -- RLS on the
 * underlying documents/projects tables scopes this to "documents in
 * projects I'm a member of" for free (see documents_views.sql's header
 * comment), the same way fetchProjects relies on projects_with_progress's
 * RLS-scoped view rather than a client-side employee filter. Search is
 * scoped to name/project_name -- linked_task_titles is an array column,
 * not a plain ilike-able one, so task-name search isn't offered here.
 */
export async function fetchMyDocuments({ page, pageSize, search, filters, sortBy, sortOrder }) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("documents_with_context")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  if (search) {
    query = query.or(`name.ilike.%${search}%,project_name.ilike.%${search}%`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    const map = { project: "project_id" };

    if (map[key]) query = query.eq(map[key], value);
  });

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return { data: data || [], totalCount: count || 0 };
}
