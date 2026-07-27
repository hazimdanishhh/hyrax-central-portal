import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Service to fetch sales_targets (Forecast 1 -- CRM pipeline quota per rep).
 * Server-side filtering and pagination, mirrors employeesService.js.
 */
export async function fetchSalesTargets({
  page,
  pageSize,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sales_targets")
    .select("*, employee:lead_owner_id (id, full_name)", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    const map = {
      owner: "lead_owner_id",
    };

    const column = map[key];
    if (!column) return;

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
