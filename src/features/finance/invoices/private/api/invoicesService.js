import { supabase } from "../../../../../lib/supabaseClient";
import {
  fetchRepsByCode,
  fetchRepNamesByCode,
  attachRep,
} from "../../../../sales/orders/private/api/salesOrdersService";
import { exclusiveUpperBound } from "../../../../../functions/dateRangeFilters";

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
    .from("sap_invoices_with_balance")
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

      case "dueSoonOnly":
        if (value === "true") {
          query = query
            .eq("status_code", "O")
            .gte("due_date", today)
            .lt("due_date", exclusiveUpperBound(dueSoonCutoff));
        }
        break;

      // Matches get_invoices_overview_rpc.sql's own criticallyOverdue
      // tile -- 90+ days past due, distinct from the plain overdueOnly
      // filter above.
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
        query = query.gte("invoice_date", value);
        break;

      case "endDate":
        query = query.lt("invoice_date", exclusiveUpperBound(value));
        break;

      default:
        break;
    }
  });

  // paginate LAST
  query = query.range(from, to);

  const [{ data, count, error }, repsByCode, namesByCode] = await Promise.all([
    query,
    fetchRepsByCode(),
    fetchRepNamesByCode(),
  ]);

  if (error) throw error;

  return {
    data: (data || []).map((invoice) =>
      attachRep(invoice, repsByCode, namesByCode),
    ),
    totalCount: count || 0,
  };
}

/**
 * Fetch-by-id fallback for the /app/finance/invoices/:docEntry detail route
 * -- covers a direct/shared URL where the invoice isn't already in the
 * in-memory paginated list. Mirrors salesOrdersService.js's
 * fetchSalesOrderByDocEntry, including the same sales-rep enrichment join.
 */
export async function fetchInvoiceByDocEntry(docEntry) {
  if (!docEntry) return null;

  const [{ data, error }, repsByCode, namesByCode] = await Promise.all([
    supabase
      .from("sap_invoices_with_balance")
      .select("*")
      .eq("doc_entry", Number(docEntry))
      .maybeSingle(),
    fetchRepsByCode(),
    fetchRepNamesByCode(),
  ]);

  if (error) throw error;
  if (!data) return null;

  return attachRep(data, repsByCode, namesByCode);
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

/**
 * Backs the Invoices list page's OverviewCards -- see
 * get_invoices_overview_rpc.sql's own comment for why this is a plain (not
 * security definer) RPC, and for why overdueOnly/dueSoonOnly/
 * criticallyOverdueOnly are deliberately NOT forwarded here. Param mapping
 * mirrors fetchFinanceDashboard.js's own filters -> rpcParams switch.
 */
export async function fetchInvoicesOverview({ filters, search } = {}) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_customer_code: null,
    p_sales_rep_code: null,
    p_status_code: null,
    p_is_cancelled: null,
    p_start_date: null,
    p_end_date: null,
    p_search: search || null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        rpcParams.p_customer_code = value === FILTER_NULL ? null : value;
        break;

      case "salesRepCode":
        rpcParams.p_sales_rep_code = value === FILTER_NULL ? null : value;
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

  const { data, error } = await supabase.rpc(
    "get_invoices_overview",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
