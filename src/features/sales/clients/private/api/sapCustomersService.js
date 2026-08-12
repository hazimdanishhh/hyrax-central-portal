import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only SAP Clients list, backed directly by the sap_customers mirror
 * table (OCRD). SAP is the system of record for this data -- no
 * create/update/delete here. Scoped to card_type 'C'/'L' (Customer/Lead),
 * excluding Vendor ('S') rows -- same business rule sapCustomerSearch.js
 * already uses for this module, since this is the Sales Clients list, not a
 * Finance vendor list. Search matches customer_name OR customer_code -- one
 * company can span 70+ customer_codes (branch-driven), see
 * hyrax-central-portal/docs/DASHBOARD-ROADMAP.md §1.4.
 */
export async function fetchSapCustomers({
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
    .from("sap_customers")
    .select("*", { count: "exact" })
    .in("card_type", ["C", "L"])
    .neq("is_deleted", "Y")
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_code.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "localExportFlag":
        if (value !== FILTER_NULL) query = query.eq("local_export_flag", value);
        break;

      case "isActive":
        if (value !== FILTER_NULL) query = query.eq("is_active", value);
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

/**
 * Fetch a single SAP customer by code -- fallback for the detail sidebar
 * when the row isn't in the current page's results (e.g. a shared URL).
 */
export async function fetchSapCustomerByCode(code) {
  if (!code) return null;

  const { data, error } = await supabase
    .from("sap_customers")
    .select("*")
    .eq("customer_code", code)
    .maybeSingle();

  if (error) throw error;

  return data;
}
