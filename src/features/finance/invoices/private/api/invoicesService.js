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
    const cleanSearch = search.trim();
    // Check if the search term is only numbers
    const isNumeric = /^\d+$/.test(cleanSearch);

    // Always search the text columns
    let orQuery = `customer_name.ilike.%${cleanSearch}%`;

    // If it's a number, also search so_number for an exact match
    if (isNumeric) {
      orQuery += `,invoice_number.eq.${cleanSearch}`;
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

/**
 * Fetch-by-id fallback for the /app/finance/invoices/:docEntry detail route
 * -- covers a direct/shared URL where the invoice isn't already in the
 * in-memory paginated list. Mirrors salesOrdersService.js's
 * fetchSalesOrderByDocEntry, minus the sales-rep enrichment join (fetchInvoices
 * doesn't join one either).
 */
export async function fetchInvoiceByDocEntry(docEntry) {
  if (!docEntry) return null;

  const { data, error } = await supabase
    .from("sap_invoices")
    .select("*")
    .eq("doc_entry", Number(docEntry))
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

/**
 * Reverse of useSalesOrdersForInvoice.js's fetchSalesOrdersForInvoice --
 * resolves the invoice(s) generated from a sales order via SAP's real
 * document trail (sap_invoice_lines' base_entry/base_type), not the
 * free-typed PO number. Two confirmed branches: base_type=17 (direct from
 * this sales order) and base_type=15 (via a delivery in between, resolved
 * through sap_delivery_lines). A live data check (2026-08) confirmed
 * sap_deliveries has no rows after 2022-05-25, and no invoice has used the
 * base_type=15 path since that same date -- so the delivery hop below is
 * included for historical correctness but will only ever resolve pre-2022
 * sales orders in practice. No uniqueness constraint exists anywhere in this
 * chain, so this can resolve to 0, 1, or many rows.
 */
export async function fetchInvoicesForSalesOrder(soDocEntry) {
  if (!soDocEntry) return [];

  const [{ data: directLines, error: directLinesError }, { data: deliveryLines, error: deliveryLinesError }] =
    await Promise.all([
      supabase
        .from("sap_invoice_lines")
        .select("doc_entry")
        .eq("base_entry", soDocEntry)
        .eq("base_type", 17),
      supabase
        .from("sap_delivery_lines")
        .select("doc_entry")
        .eq("base_entry", soDocEntry)
        .eq("base_type", 17),
    ]);

  if (directLinesError) throw directLinesError;
  if (deliveryLinesError) throw deliveryLinesError;

  const directInvoiceIds = (directLines || []).map((line) => line.doc_entry);

  const deliveryIds = [
    ...new Set((deliveryLines || []).map((line) => line.doc_entry)),
  ];

  let invoiceIdsViaDelivery = [];
  if (deliveryIds.length > 0) {
    const { data: viaDeliveryLines, error: viaDeliveryLinesError } =
      await supabase
        .from("sap_invoice_lines")
        .select("doc_entry")
        .in("base_entry", deliveryIds)
        .eq("base_type", 15);

    if (viaDeliveryLinesError) throw viaDeliveryLinesError;
    invoiceIdsViaDelivery = (viaDeliveryLines || []).map(
      (line) => line.doc_entry,
    );
  }

  const invoiceIds = [
    ...new Set([...directInvoiceIds, ...invoiceIdsViaDelivery]),
  ];
  if (invoiceIds.length === 0) return [];

  const { data: invoices, error: invoicesError } = await supabase
    .from("sap_invoices")
    .select("*")
    .in("doc_entry", invoiceIds);

  if (invoicesError) throw invoicesError;

  return invoices || [];
}
