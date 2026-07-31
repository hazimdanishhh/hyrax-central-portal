import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only invoice list, backed directly by the sap_invoices mirror table.
 * SAP is the system of record for this data -- no create/update/delete here.
 */
export async function fetchInvoices({
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
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("sap_invoices")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        if (value !== FILTER_NULL) query = query.eq("customer_code", value);
        break;

      // Plural, distinct from "customerCode" above -- a one-off multi-value
      // need (Sales Reports' Customer Concentration tile links its top-5
      // customers at once), not a generic array-filter mechanism. Value is a
      // comma-joined string (buildFilterUrl's existing array serialization).
      case "customerCodes":
        if (value) query = query.in("customer_code", String(value).split(","));
        break;

      case "salesRepCode":
        if (value !== FILTER_NULL) query = query.eq("sales_rep_code", value);
        break;

      case "statusCode":
        if (value !== FILTER_NULL) query = query.eq("status_code", value);
        break;

      case "isCancelled":
        if (value !== FILTER_NULL) query = query.eq("is_cancelled", value);
        break;

      case "overdueOnly":
        if (value === "true") {
          query = query.eq("status_code", "O").lt("due_date", today);
        }
        break;

      case "startDate":
        query = query.gte("invoice_date", value);
        break;

      case "endDate":
        query = query.lte("invoice_date", value);
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
