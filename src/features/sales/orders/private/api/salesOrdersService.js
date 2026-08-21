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
    const cleanSearch = search.trim();
    // Check if the search term is only numbers
    const isNumeric = /^\d+$/.test(cleanSearch);

    // Always search the text columns
    let orQuery = `customer_name.ilike.%${cleanSearch}%,customer_ref.ilike.%${cleanSearch}%`;

    // If it's a number, also search so_number for an exact match
    if (isNumeric) {
      orQuery += `,so_number.eq.${cleanSearch}`;
    }

    query = query.or(orQuery);
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

/**
 * Reverse of invoicesService.js's fetchInvoicesForSalesOrder -- resolves the
 * sales order(s) an invoice was generated from via SAP's real document trail
 * (sap_invoice_lines' base_entry/base_type), not the free-typed PO number
 * (unlike useSalesOrderByPoNumber.js's Lead<->Order match). Two confirmed
 * branches: base_type=17 (direct from a sales order) and base_type=15 (via a
 * delivery in between, resolved through sap_delivery_lines). A live data
 * check (2026-08) confirmed sap_deliveries has no rows after 2022-05-25, and
 * no invoice has used the base_type=15 path since that same date -- so the
 * delivery hop below is included for historical correctness but will only
 * ever resolve pre-2022 invoices in practice. No uniqueness constraint
 * exists anywhere in this chain, so this can resolve to 0, 1, or many rows.
 */
export async function fetchSalesOrdersForInvoice(invoiceDocEntry) {
  if (!invoiceDocEntry) return [];

  const { data: lines, error: linesError } = await supabase
    .from("sap_invoice_lines")
    .select("base_entry, base_type")
    .eq("doc_entry", invoiceDocEntry);

  if (linesError) throw linesError;
  if (!lines?.length) return [];

  const directSoIds = lines
    .filter((line) => line.base_type === 17)
    .map((line) => line.base_entry);

  const deliveryIds = [
    ...new Set(
      lines
        .filter((line) => line.base_type === 15)
        .map((line) => line.base_entry),
    ),
  ];

  let soIdsViaDelivery = [];
  if (deliveryIds.length > 0) {
    const { data: deliveryLines, error: deliveryLinesError } = await supabase
      .from("sap_delivery_lines")
      .select("base_entry")
      .in("doc_entry", deliveryIds)
      .eq("base_type", 17);

    if (deliveryLinesError) throw deliveryLinesError;
    soIdsViaDelivery = (deliveryLines || []).map((line) => line.base_entry);
  }

  const soIds = [...new Set([...directSoIds, ...soIdsViaDelivery])];
  if (soIds.length === 0) return [];

  const [{ data: orders, error: ordersError }, repsByCode] = await Promise.all([
    supabase.from("sap_sales_orders").select("*").in("doc_entry", soIds),
    fetchRepsByCode(),
  ]);

  if (ordersError) throw ordersError;

  return (orders || []).map((order) => attachRep(order, repsByCode));
}
