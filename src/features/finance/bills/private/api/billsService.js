import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only vendor bill list, backed directly by the sap_vendor_bills mirror
 * table. SAP is the system of record for this data -- no create/update/delete
 * here.
 */
export async function fetchBills({
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
  const dueSoonCutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let query = supabase
    .from("sap_vendor_bills")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    const cleanSearch = search.trim();
    // Check if the search term is only numbers
    const isNumeric = /^\d+$/.test(cleanSearch);

    // Always search the text columns
    let orQuery = `vendor_name.ilike.%${cleanSearch}%`;

    // If it's a number, also search so_number for an exact match
    if (isNumeric) {
      orQuery += `,bill_number.eq.${cleanSearch}`;
    }

    query = query.or(orQuery);
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "vendorCode":
        if (value !== FILTER_NULL) query = query.eq("vendor_code", value);
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

      case "dueSoonOnly":
        if (value === "true") {
          query = query
            .eq("status_code", "O")
            .gte("due_date", today)
            .lte("due_date", dueSoonCutoff);
        }
        break;

      case "startDate":
        query = query.gte("bill_date", value);
        break;

      case "endDate":
        query = query.lte("bill_date", value);
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
 * Fetch-by-id fallback for the /app/finance/bills/:docEntry detail route --
 * covers a direct/shared URL where the bill isn't already in the in-memory
 * paginated list. Mirrors salesOrdersService.js's fetchSalesOrderByDocEntry,
 * minus the rep-enrichment join (fetchBills doesn't join one either).
 */
export async function fetchBillByDocEntry(docEntry) {
  if (!docEntry) return null;

  const { data, error } = await supabase
    .from("sap_vendor_bills")
    .select("*")
    .eq("doc_entry", Number(docEntry))
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

/**
 * Backs the Bills list page's OverviewCards -- see
 * get_bills_overview_rpc.sql's own comment for why this is a plain (not
 * security definer) RPC.
 */
export async function fetchBillsOverview() {
  const { data, error } = await supabase.rpc("get_bills_overview");

  if (error) throw error;

  return data;
}
