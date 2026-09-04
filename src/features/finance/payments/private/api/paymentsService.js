import { supabase } from "../../../../../lib/supabaseClient";
import { fetchInvoicesForSalesOrder } from "../../../invoices/private/api/invoicesService";

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

/**
 * Fetch-by-id fallback for the /app/finance/payments/:docEntry detail route
 * -- covers a direct/shared URL where the payment isn't already in the
 * in-memory paginated list. Mirrors salesOrdersService.js's
 * fetchSalesOrderByDocEntry, minus the rep-enrichment join (fetchPayments
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
 * Generalizes fetchPaymentsForInvoice above to a list of invoices -- same
 * two-step shape (payment_applications -> dedupe payment_ref -> sap_payments
 * .in()), just querying sap_payment_applications.doc_entry with .in() instead
 * of .eq(). Backs fetchPaymentsForSalesOrder below. The final .in() naturally
 * returns each payment once even if it was referenced via multiple invoices'
 * payment_ref entries, since paymentDocEntries is deduped into a Set first --
 * no extra dedupe pass needed for the flat-list use case.
 */
export async function fetchPaymentsForInvoices(invoiceDocEntries) {
  if (!invoiceDocEntries || invoiceDocEntries.length === 0) return [];

  const { data: applications, error: applicationsError } = await supabase
    .from("sap_payment_applications")
    .select("payment_ref")
    .in("doc_entry", invoiceDocEntries)
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
 * Backs the Sales Order Sidebar's "MATCHED PAYMENT(S)" block. SAP has no
 * direct SO->Payment link -- a payment only ever applies to an invoice -- so
 * this is a transitive join: SO -> matched invoice(s) (reusing
 * fetchInvoicesForSalesOrder's own base_entry/base_type document trail,
 * rather than re-deriving it) -> payment(s) applied to those invoices. Flat
 * list, same as fetchPaymentsForInvoice -- a payment's own detail page
 * already shows exactly which invoice(s) it applied to for anyone who needs
 * that level of detail.
 */
export async function fetchPaymentsForSalesOrder(soDocEntry) {
  if (!soDocEntry) return [];

  const invoices = await fetchInvoicesForSalesOrder(soDocEntry);
  if (invoices.length === 0) return [];

  return fetchPaymentsForInvoices(invoices.map((invoice) => invoice.doc_entry));
}
