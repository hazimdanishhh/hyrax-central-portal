import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only Chart of Accounts reference list, backed directly by the
 * sap_gl_accounts mirror table (OACT). SAP is the system of record for this
 * data -- no create/update/delete here. A reference dimension, not
 * transactional data, so no date-range filter -- just drawer/is_postable.
 */
export async function fetchChartOfAccounts({
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
    .from("sap_gl_accounts")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `account_code.ilike.%${search}%,account_name.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "drawer":
        if (value !== FILTER_NULL) query = query.eq("drawer", value);
        break;

      case "isPostable":
        if (value !== FILTER_NULL) query = query.eq("is_postable", value);
        break;

      default:
        break;
    }
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
