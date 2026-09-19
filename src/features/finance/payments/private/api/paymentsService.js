import { supabase } from "../../../../../lib/supabaseClient";
import { resolveInvoiceIdsForSalesOrder } from "../../../invoices/private/api/invoicesService";
import { exclusiveUpperBound } from "../../../../../functions/dateRangeFilters";

/**
 * Read-only payment list, backed directly by the sap_payments mirror table
 * (ORCT). SAP is the system of record for this data -- no create/update/
 * delete here.
 */
export async function fetchPayments({
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
    .from("sap_payments")
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
      orQuery += `,receipt_number.eq.${cleanSearch}`;
    }

    query = query.or(orQuery);
  }

  // --- SALES ORDER (reverse link from the Sales Order Fulfillment
  // sidebar's "View all payments" button) -- resolves via the same
  // SO->invoice->payment-application transitive join
  // fetchPaymentsForSalesOrder uses, extracted into
  // resolvePaymentIdsForInvoices/resolveInvoiceIdsForSalesOrder so both
  // share one implementation. Handled outside the synchronous filter switch
  // below since it needs an async resolve first -- same shape as
  // invoicesService.js's own salesOrderDocEntry filter.
  if (filters?.salesOrderDocEntry) {
    const invoiceIds = await resolveInvoiceIdsForSalesOrder(
      Number(filters.salesOrderDocEntry),
    );
    const matchingIds =
      invoiceIds.length > 0
        ? await resolvePaymentIdsForInvoices(invoiceIds)
        : [];
    query = query.in("doc_entry", matchingIds.length > 0 ? matchingIds : [-1]);
  }

  // --- FILTERS ---
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        if (value !== FILTER_NULL) query = query.eq("customer_code", value);
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
        query = query.lt("payment_date", exclusiveUpperBound(value));
        break;

      default:
        break; // salesOrderDocEntry already resolved above
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
 * Backs the Payments list page's OverviewCards -- see
 * get_payments_overview_rpc.sql's own comment for why this is a plain (not
 * security definer) RPC. unallocatedOnly (added 2026-09) IS forwarded now --
 * it feeds the RPC's totals_scope CTE for the Total tile only, never
 * base_payments, so the Unallocated/This Week/This Month tiles stay exactly
 * as filter-blind as before (see that SQL file's own comment). Param mapping
 * otherwise mirrors fetchFinanceDashboard.js's own filters -> rpcParams
 * switch.
 */
export async function fetchPaymentsOverview({ filters, search } = {}) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_customer_code: null,
    p_is_cancelled: null,
    p_start_date: null,
    p_end_date: null,
    p_search: search || null,
    p_unallocated_only: null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        rpcParams.p_customer_code = value === FILTER_NULL ? null : value;
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

      case "unallocatedOnly":
        rpcParams.p_unallocated_only = value === "true" ? true : null;
        break;

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc(
    "get_payments_overview",
    rpcParams,
  );

  if (error) throw error;

  return data;
}

/**
 * Fetch-by-id fallback for the /app/finance/invoices/payments/:docEntry detail route
 * -- covers a direct/shared URL where the payment isn't already in the
 * in-memory paginated list. Mirrors salesOrdersService.js's
 * fetchFulfillmentOrderByDocEntry, minus the rep-enrichment join (fetchPayments
 * doesn't join one either).
 */
export async function fetchPaymentByDocEntry(docEntry) {
  if (!docEntry) return null;

  const { data, error } = await supabase
    .from("sap_payments")
    .select("*")
    .eq("doc_entry", Number(docEntry))
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

/**
 * Backs the Invoice Sidebar's "MATCHED PAYMENT(S)" block -- reverse of
 * fetchPaymentApplications.js's per-payment enrichment. Resolves the
 * payment(s) applied against one invoice via the same confirmed FK
 * (sap_payment_applications.doc_entry -> sap_invoices.doc_entry, filtered
 * inv_type = 13), just queried from the invoice's side of payment_ref
 * instead. 0/1/many -- an invoice can be paid across several partial
 * payments.
 */
export async function fetchPaymentsForInvoice(invoiceDocEntry) {
  if (!invoiceDocEntry) return [];

  const { data: applications, error: applicationsError } = await supabase
    .from("sap_payment_applications")
    .select("payment_ref")
    .eq("doc_entry", invoiceDocEntry)
    .eq("inv_type", 13);

  if (applicationsError) throw applicationsError;

  const paymentDocEntries = [
    ...new Set((applications || []).map((application) => application.payment_ref)),
  ];
  if (paymentDocEntries.length === 0) return [];

  const { data: payments, error: paymentsError } = await supabase
    .from("sap_payments")
    .select("*")
    .in("doc_entry", paymentDocEntries);

  if (paymentsError) throw paymentsError;

  return payments || [];
}

/**
 * Resolves the payment doc_entrys applied against a set of invoices, via
 * sap_payment_applications (payment_ref -> sap_payments.doc_entry, filtered
 * inv_type=13) -- shared by fetchPaymentsForInvoices below (full payment
 * objects) and fetchPayments' salesOrderDocEntry filter above (ids only).
 * The final Set dedupe naturally handles a payment referenced via multiple
 * invoices' payment_ref entries -- no extra dedupe pass needed.
 */
async function resolvePaymentIdsForInvoices(invoiceDocEntries) {
  if (!invoiceDocEntries || invoiceDocEntries.length === 0) return [];

  const { data: applications, error: applicationsError } = await supabase
    .from("sap_payment_applications")
    .select("payment_ref")
    .in("doc_entry", invoiceDocEntries)
    .eq("inv_type", 13);

  if (applicationsError) throw applicationsError;

  return [
    ...new Set((applications || []).map((application) => application.payment_ref)),
  ];
}

/**
 * Generalizes fetchPaymentsForInvoice above to a list of invoices. Backs
 * fetchPaymentsForSalesOrder below.
 */
export async function fetchPaymentsForInvoices(invoiceDocEntries) {
  const paymentDocEntries = await resolvePaymentIdsForInvoices(invoiceDocEntries);
  if (paymentDocEntries.length === 0) return [];

  const { data: payments, error: paymentsError } = await supabase
    .from("sap_payments")
    .select("*")
    .in("doc_entry", paymentDocEntries)
    .order("payment_date", { ascending: false });

  if (paymentsError) throw paymentsError;

  return payments || [];
}

/**
 * Backs the Sales Order Sidebar's "MATCHED PAYMENT(S)" block. SAP has no
 * direct SO->Payment link -- a payment only ever applies to an invoice -- so
 * this is a transitive join: SO -> matched invoice(s) (reusing
 * resolveInvoiceIdsForSalesOrder's own base_entry/base_type document trail,
 * rather than re-deriving it) -> payment(s) applied to those invoices.
 * Capped to the 5 most recent matches, same shape as
 * fetchInvoicesForSalesOrder's own cap -- `totalCount` is the TRUE match
 * count, used by the "View all N payments" button, which links through the
 * salesOrderDocEntry filter above rather than the capped preview's own
 * doc_entrys.
 */
export async function fetchPaymentsForSalesOrder(soDocEntry) {
  if (!soDocEntry) return { data: [], totalCount: 0 };

  const invoiceIds = await resolveInvoiceIdsForSalesOrder(soDocEntry);
  if (invoiceIds.length === 0) return { data: [], totalCount: 0 };

  const payments = await fetchPaymentsForInvoices(invoiceIds);

  return {
    data: payments.slice(0, 5),
    totalCount: payments.length,
  };
}
