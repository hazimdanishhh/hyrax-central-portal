import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Resolves sap_sales_orders.sales_rep_code -> the owning employee (for
 * SalesOrderCard's avatar). Done as a separate, small full-table fetch --
 * NOT a PostgREST embedded select -- because sap_sales_orders.sales_rep_code
 * has no real FK constraint (only employee_sales_rep_mapping.sales_rep_code
 * -> sap_sales_persons.sales_rep_code does), and PostgREST's `!` embed
 * syntax requires an actual FK to resolve a relationship. Same "small
 * outrigger table, fetch it whole" reasoning as
 * salesRepMappingService.js/salesOrdersMetadataService.js's own
 * sap_sales_persons fetch. employees_public (not the raw employees table)
 * is used so avatar_url comes pre-joined from profiles, same as
 * leadsService.js's lead_owner:employees_public!lead_owner_id(*) precedent.
 */
async function fetchRepsByCode() {
  const { data, error } = await supabase
    .from("employee_sales_rep_mapping")
    .select("sales_rep_code, employee:employees_public!employee_id(*)");

  if (error) throw error;

  const repsByCode = {};
  (data || []).forEach((row) => {
    repsByCode[row.sales_rep_code] = row.employee || null;
  });

  return repsByCode;
}

function attachRep(order, repsByCode) {
  return { ...order, rep: repsByCode[order.sales_rep_code] || null };
}

/**
 * Read-only sales order list, backed directly by the sap_sales_orders
 * mirror table (ORDR). SAP is the system of record for this data -- no
 * create/update/delete here.
 */
export async function fetchSalesOrders({
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
    .from("sap_sales_orders")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `so_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_ref.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        if (value !== FILTER_NULL) query = query.eq("customer_code", value);
        break;

      case "customerRef":
        if (value !== FILTER_NULL) query = query.eq("customer_ref", value);
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

      case "startDate":
        query = query.gte("order_date", value);
        break;

      case "endDate":
        query = query.lte("order_date", value);
        break;

      default:
        break;
    }
  });

  // paginate LAST
  query = query.range(from, to);

  const [{ data, count, error }, repsByCode] = await Promise.all([
    query,
    fetchRepsByCode(),
  ]);

  if (error) throw error;

  return {
    data: (data || []).map((order) => attachRep(order, repsByCode)),
    totalCount: count || 0,
  };
}

/**
 * Fetch a single sales order by its natural key (doc_entry), for the
 * deep-linkable /app/sales/orders/all/:docEntry detail route -- mirrors
 * fetchLeadById's role for useLead (see useSalesOrder.js).
 */
export async function fetchSalesOrderByDocEntry(docEntry) {
  if (!docEntry) return null;

  const [{ data, error }, repsByCode] = await Promise.all([
    supabase
      .from("sap_sales_orders")
      .select("*")
      .eq("doc_entry", Number(docEntry))
      .maybeSingle(),
    fetchRepsByCode(),
  ]);

  if (error) throw error;
  if (!data) return null;

  return attachRep(data, repsByCode);
}
