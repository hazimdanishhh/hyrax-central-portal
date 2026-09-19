import { supabase } from "../../../../../lib/supabaseClient";
import {
  fetchRepsByCode,
  fetchRepNamesByCode,
  attachRep,
} from "../../../../sales/orders/private/api/salesOrdersService";
import { exclusiveUpperBound } from "../../../../../functions/dateRangeFilters";
import { fetchAllSupabaseRows } from "../../../../../functions/fetchAllSupabaseRows";

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

  // --- SALES ORDER (reverse link from Invoice Sidebar's "Matched Sales
  // Order(s)" -- "View all invoices for this order") -- resolves via the
  // same base_entry/base_type document trail fetchInvoicesForSalesOrder
  // uses, extracted into resolveInvoiceIdsForSalesOrder so both share one
  // implementation. Handled outside the synchronous filter switch below
  // since it needs an async resolve first -- same shape as
  // journalEntriesService.js's accountCode filter. [-1] sentinel keeps a
  // genuine zero-match filter returning zero rows.
  if (filters?.salesOrderDocEntry) {
    const matchingIds = await resolveInvoiceIdsForSalesOrder(
      Number(filters.salesOrderDocEntry),
    );
    query = query.in("doc_entry", matchingIds.length > 0 ? matchingIds : [-1]);
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

      // Surfaces the paid_to_date-vs-applied_payment_myr divergence found
      // 2026-09 -- see finance_outstanding_balance_views.sql's own
      // has_paid_mismatch comment for why this needs a real column rather
      // than a client-side comparison.
      case "paidMismatchOnly":
        if (value === "true") query = query.eq("has_paid_mismatch", true);
        break;

      case "startDate":
        query = query.gte("invoice_date", value);
        break;

      case "endDate":
        query = query.lt("invoice_date", exclusiveUpperBound(value));
        break;

      default:
        break; // salesOrderDocEntry already resolved above
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
 * Fetch-by-id fallback for the /app/finance/invoices/list/:docEntry detail route
 * -- covers a direct/shared URL where the invoice isn't already in the
 * in-memory paginated list. Mirrors salesOrdersService.js's
 * fetchFulfillmentOrderByDocEntry, including the same sales-rep enrichment join.
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
 * Resolves the invoice doc_entrys generated from a sales order via SAP's
 * real document trail (sap_invoice_lines' base_entry/base_type) -- shared
 * by fetchInvoicesForSalesOrder below (full invoice objects, for the Sales
 * Order Sidebar's "Matched Invoice(s)" preview) and fetchInvoices'
 * salesOrderDocEntry filter above (ids only, for the Invoice Sidebar's
 * plain "View all invoices for this order" link -- no preview data
 * needed there, so no reason to fetch full rows just to discard them).
 * Two confirmed branches: base_type=17 (direct from this sales order) and
 * base_type=15 (via a delivery in between, resolved through
 * sap_delivery_lines). A live data check (2026-08) confirmed
 * sap_deliveries has no rows after 2022-05-25, and no invoice has used the
 * base_type=15 path since that same date -- so the delivery hop below is
 * included for historical correctness but will only ever resolve pre-2022
 * sales orders in practice.
 */
export async function resolveInvoiceIdsForSalesOrder(soDocEntry) {
  if (!soDocEntry) return [];

  // fetchAllSupabaseRows (added 2026-09) rather than a single unbounded
  // .select() -- same latent truncation risk journalEntriesService.js's
  // resolveTransIdsByLineColumn had (confirmed live for a high-volume GL
  // account); low real-world odds here since one sales order's own lines
  // are naturally few, but the fix is free and keeps this correct
  // regardless. Ordered by doc_entry for deterministic pagination.
  const [directLines, deliveryLines] = await Promise.all([
    fetchAllSupabaseRows(() =>
      supabase
        .from("sap_invoice_lines")
        .select("doc_entry")
        .eq("base_entry", soDocEntry)
        .eq("base_type", 17)
        .order("doc_entry", { ascending: true }),
    ),
    fetchAllSupabaseRows(() =>
      supabase
        .from("sap_delivery_lines")
        .select("doc_entry")
        .eq("base_entry", soDocEntry)
        .eq("base_type", 17)
        .order("doc_entry", { ascending: true }),
    ),
  ]);

  const directInvoiceIds = directLines.map((line) => line.doc_entry);

  const deliveryIds = [
    ...new Set(deliveryLines.map((line) => line.doc_entry)),
  ];

  let invoiceIdsViaDelivery = [];
  if (deliveryIds.length > 0) {
    const viaDeliveryLines = await fetchAllSupabaseRows(() =>
      supabase
        .from("sap_invoice_lines")
        .select("doc_entry")
        .in("base_entry", deliveryIds)
        .eq("base_type", 15)
        .order("doc_entry", { ascending: true }),
    );
    invoiceIdsViaDelivery = viaDeliveryLines.map((line) => line.doc_entry);
  }

  return [...new Set([...directInvoiceIds, ...invoiceIdsViaDelivery])];
}

/**
 * Reverse of useSalesOrdersForInvoice.js's fetchSalesOrdersForInvoice --
 * backs the Sales Order Sidebar's "Matched Invoice(s)" preview. Capped to
 * the 5 most recent matches (same shape as the Business Partner Sidebar's
 * preview hooks, e.g. useInvoicesForCustomer.js) -- `totalCount` is the
 * TRUE match count (cheap: it's just resolveInvoiceIdsForSalesOrder's own
 * id-list length, no second count query needed), used by the "View all N
 * invoices" button, which links through the salesOrderDocEntry filter above
 * rather than the capped preview's own doc_entrys -- otherwise "View all"
 * would silently drop anything past the first 5. No uniqueness constraint
 * exists anywhere in the underlying document trail (see
 * resolveInvoiceIdsForSalesOrder above), so this can resolve to 0, 1, or
 * many rows.
 */
export async function fetchInvoicesForSalesOrder(soDocEntry) {
  const invoiceIds = await resolveInvoiceIdsForSalesOrder(soDocEntry);
  if (invoiceIds.length === 0) return { data: [], totalCount: 0 };

  // sap_invoices_with_balance, not the raw table -- so a matched invoice
  // card rendered inside a Sales Order sidebar shows real outstanding_
  // balance/applied_payment_myr/has_paid_mismatch figures instead of
  // silently defaulting to 0 (a real gap found 2026-09: this fetch never
  // included those columns before).
  const [{ data: invoices, error: invoicesError }, repsByCode, namesByCode] =
    await Promise.all([
      supabase
        .from("sap_invoices_with_balance")
        .select("*")
        .in("doc_entry", invoiceIds)
        .order("invoice_date", { ascending: false })
        .limit(5),
      fetchRepsByCode(),
      fetchRepNamesByCode(),
    ]);

  if (invoicesError) throw invoicesError;

  // Same rep-enrichment join fetchInvoices/fetchInvoiceByDocEntry already
  // do -- without this, InvoiceCard's SalesRepBadge falls back to showing
  // the bare sales_rep_code ("unmapped rep #") for every matched invoice in
  // a Sales Order's sidebar, regardless of whether that rep actually has a
  // mapping (a real gap: this fetch never attached `rep` at all).
  return {
    data: (invoices || []).map((invoice) =>
      attachRep(invoice, repsByCode, namesByCode),
    ),
    totalCount: invoiceIds.length,
  };
}

/**
 * Backs the Invoices list page's OverviewCards -- see
 * get_invoices_overview_rpc.sql's own comment for why this is a plain (not
 * security definer) RPC. overdueOnly/dueSoonOnly/criticallyOverdueOnly/
 * hasBalanceOnly/paidMismatchOnly/customerCodes (added 2026-09) ARE forwarded
 * now -- they feed the RPC's totals_scope CTE for the Total tile only, never
 * base_invoices, so the Outstanding/Due Soon/Overdue/Critically Overdue tiles
 * stay exactly as filter-blind as before (see that SQL file's own comment).
 * salesOrderDocEntry is NOT forwarded -- no RPC param exists for it (would
 * need porting fetchInvoices' async sales-order document-trail resolve into
 * SQL for a legacy-only drill-through path; not worth it). Param mapping
 * otherwise mirrors fetchFinanceDashboard.js's own filters -> rpcParams
 * switch.
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
    p_has_balance_only: null,
    p_paid_mismatch_only: null,
    p_overdue_only: null,
    p_due_soon_only: null,
    p_critically_overdue_only: null,
    p_customer_codes: null,
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

      case "hasBalanceOnly":
        rpcParams.p_has_balance_only = value === "true" ? true : null;
        break;

      case "paidMismatchOnly":
        rpcParams.p_paid_mismatch_only = value === "true" ? true : null;
        break;

      case "overdueOnly":
        rpcParams.p_overdue_only = value === "true" ? true : null;
        break;

      case "dueSoonOnly":
        rpcParams.p_due_soon_only = value === "true" ? true : null;
        break;

      case "criticallyOverdueOnly":
        rpcParams.p_critically_overdue_only = value === "true" ? true : null;
        break;

      case "customerCodes":
        rpcParams.p_customer_codes = value || null;
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
