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
    const cleanSearch = search.trim();
    // Check if the search term is only numbers
    const isNumeric = /^\d+$/.test(cleanSearch);

    // Always search the text columns
    let orQuery = `vendor_name.ilike.%${cleanSearch}%`;

    // If it's a number, also search so_number for an exact match
    if (isNumeric) {
      orQuery += `,payment_number.eq.${cleanSearch}`;
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
 * Fetch-by-id fallback for the /app/finance/vendor-payments/:docEntry detail
 * route -- covers a direct/shared URL where the vendor payment isn't already
 * in the in-memory paginated list. Mirrors salesOrdersService.js's
 * fetchSalesOrderByDocEntry, minus the rep-enrichment join
 * (fetchVendorPayments doesn't join one either).
 */
export async function fetchVendorPaymentByDocEntry(docEntry) {
  if (!docEntry) return null;

  const { data, error } = await supabase
    .from("sap_vendor_payments")
    .select("*")
    .eq("doc_entry", Number(docEntry))
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

/**
 * Backs the Bill Sidebar's "MATCHED VENDOR PAYMENT(S)" block -- reverse of
 * fetchVendorPaymentApplications.js's per-vendor-payment enrichment. AP
 * mirror of paymentsService.js's fetchPaymentsForInvoice, using the confirmed
 * FK (sap_vendor_payment_applications.doc_entry -> sap_vendor_bills.doc_entry,
 * filtered doc_type = 18). 0/1/many -- a bill can be paid across several
 * partial payments.
 */
export async function fetchVendorPaymentsForBill(billDocEntry) {
  if (!billDocEntry) return [];

  const { data: applications, error: applicationsError } = await supabase
    .from("sap_vendor_payment_applications")
    .select("payment_ref")
    .eq("doc_entry", billDocEntry)
    .eq("doc_type", 18);

  if (applicationsError) throw applicationsError;

  const vendorPaymentDocEntries = [
    ...new Set((applications || []).map((application) => application.payment_ref)),
  ];
  if (vendorPaymentDocEntries.length === 0) return [];

  const { data: vendorPayments, error: vendorPaymentsError } = await supabase
    .from("sap_vendor_payments")
    .select("*")
    .in("doc_entry", vendorPaymentDocEntries);

  if (vendorPaymentsError) throw vendorPaymentsError;

  return vendorPayments || [];
}
