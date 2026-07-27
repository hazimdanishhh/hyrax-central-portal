import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only vendor payment list, backed directly by the sap_vendor_payments
 * mirror table (OVPM) -- AP mirror of sap_payments (ORCT). SAP is the system
 * of record for this data -- no create/update/delete here.
 */
export async function fetchVendorPayments({
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
    .from("sap_vendor_payments")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `payment_number.ilike.%${search}%,vendor_name.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "vendorCode":
        if (value !== FILTER_NULL) query = query.eq("vendor_code", value);
        break;

      case "isCancelled":
        if (value !== FILTER_NULL) query = query.eq("is_cancelled", value);
        break;

      case "unallocatedOnly":
        // Matches get_finance_dashboard_rpc.sql's own "meaningfully
        // unallocated" threshold (> 0.01), not just > 0 -- avoids floating
        // point dust showing rows with e.g. RM 0.0000001 unallocated.
        if (value === "true") query = query.gt("unallocated_amount", 0.01);
        break;

      case "startDate":
        query = query.gte("payment_date", value);
        break;

      case "endDate":
        query = query.lte("payment_date", value);
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
