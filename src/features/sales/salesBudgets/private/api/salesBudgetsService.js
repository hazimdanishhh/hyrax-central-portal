import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Service to fetch sales_budgets (Forecast 2 -- SAP invoice quota per rep).
 * Server-side filtering and pagination, mirrors employeesService.js.
 */
export async function fetchSalesBudgets({
  page,
  pageSize,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sales_budgets")
    .select(
      "*, sales_rep:sales_rep_code (sales_rep_code, sales_rep_name)",
      { count: "exact" },
    )
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    const map = {
      salesRepCode: "sales_rep_code",
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
