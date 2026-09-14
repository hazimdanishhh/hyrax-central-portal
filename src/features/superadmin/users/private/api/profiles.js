import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Service to fetch all System Profiles (Users)
 * Server-side filtering and pagination
 */
export async function fetchProfiles({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const FILTER_NULL = "__null__";

  let query = supabase
    .from("profiles")
    .select(
      `*,
        role:role_id(*),
        department:department_id(*)
        `,
      { count: "exact" },
    )
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    const map = {
      department: "department_id",
      role: "role_id",
    };

    const column = map[key];
    if (!column) return;

    // ✅ NULL filter (ONLY for real null)
    if (value === FILTER_NULL) {
      query = query.is(column, null);
      return;
    }

    query = query.eq(column, value);
  });

  // paginate LAST
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

// Fallback fetch for a deep link to a row not on the current page (see
// Users.jsx's URL-driven sidebar) -- same select shape as fetchProfiles,
// scoped to one id.
export async function fetchProfileById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `*,
        role:role_id(*),
        department:department_id(*)
        `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
}
