import { supabase } from "../../../../../lib/supabaseClient";
import { exclusiveUpperBound } from "../../../../../functions/dateRangeFilters";

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
  const criticallyOverdueCutoff = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .split("T")[0];

  // Queries the balance-enriched view (see finance_outstanding_balance_
  // views.sql), not the raw table -- adds outstanding_balance as a real,
  // filterable column (see hasBalanceOnly below), same columns otherwise.
  let query = supabase
    .from("sap_vendor_bills_with_balance")
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
            .lt("due_date", exclusiveUpperBound(dueSoonCutoff));
        }
        break;

      // Matches get_bills_overview_rpc.sql's own criticallyOverdue tile --
      // 90+ days past due, distinct from the plain overdueOnly filter above.
      case "criticallyOverdueOnly":
        if (value === "true") {
          query = query
            .eq("status_code", "O")
            .lt("due_date", criticallyOverdueCutoff);
        }
        break;

      // Closes the KPI-vs-list reconciliation gap: Outstanding/Due Soon/
      // Overdue/Critically Overdue all require this same "real balance
      // remaining" condition on top of status_code -- see
      // finance_outstanding_balance_views.sql's header comment.
      case "hasBalanceOnly":
        if (value === "true") query = query.gt("outstanding_balance", 0.01);
        break;

      case "startDate":
        query = query.gte("bill_date", value);
        break;

      case "endDate":
        query = query.lt("bill_date", exclusiveUpperBound(value));
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
    .from("sap_vendor_bills_with_balance")
    .select("*")
    .eq("doc_entry", Number(docEntry))
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

/**
 * Backs the Bills list page's OverviewCards -- see
 * get_bills_overview_rpc.sql's own comment for why this is a plain (not
 * security definer) RPC, and for why overdueOnly/dueSoonOnly/
 * criticallyOverdueOnly are deliberately NOT forwarded here. Param mapping
 * mirrors fetchFinanceDashboard.js's own filters -> rpcParams switch.
 */
export async function fetchBillsOverview({ filters, search } = {}) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_vendor_code: null,
    p_status_code: null,
    p_is_cancelled: null,
    p_start_date: null,
    p_end_date: null,
    p_search: search || null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "vendorCode":
        rpcParams.p_vendor_code = value === FILTER_NULL ? null : value;
        break;

      case "statusCode":
        rpcParams.p_status_code = value === FILTER_NULL ? null : value;
        break;

      case "isCancelled":
        rpcParams.p_is_cancelled = value === FILTER_NULL ? null : value;
        break;

      case "startDate":
        rpcParams.p_start_date = value;
        break;

      case "endDate":
        rpcParams.p_end_date = value;
        break;

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc("get_bills_overview", rpcParams);

  if (error) throw error;

  return data;
}
