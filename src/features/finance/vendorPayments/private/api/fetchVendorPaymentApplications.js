import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only "what was this vendor payment applied to" list, backed by
 * sap_vendor_payment_applications (VPM2) -- AP mirror of
 * sap_payment_applications (RCT2). Join key is payment_ref ->
 * sap_vendor_payments.doc_entry (the only FK to OVPM that exists on this
 * table) -- same RCT2-style join trap as the AR side, see
 * data-dictionary.md.
 *
 * inv_entry/doc_type/doc_entry are returned raw, NOT resolved to a bill here.
 * doc_entry -> sap_vendor_bills.doc_entry is confirmed, but only when
 * doc_type = 18 (OPCH, vendor bill) -- doc_type = 19 (ORPC, A/P credit memo)
 * and other values point at different, unextracted document tables, which is
 * expected, not a bug (see get_finance_dashboard_rpc.sql's "THE VPM2 JOIN
 * TRAP" comment). inv_entry is NOT the bill FK -- its true meaning is
 * undetermined, same caveat as sap_payment_applications.inv_entry on the AR
 * side. Resolving doc_entry into a displayed bill number (join
 * sap_vendor_bills on doc_entry + doc_type=18, left-join to leave non-bill
 * rows blank) is a small, not-yet-done follow-up -- raw values are still
 * shown here for now.
 */
export async function fetchVendorPaymentApplications(vendorPaymentDocEntry) {
  if (!vendorPaymentDocEntry) return [];

  const { data, error } = await supabase
    .from("sap_vendor_payment_applications")
    .select("*")
    .eq("payment_ref", vendorPaymentDocEntry);

  if (error) throw error;

  return data || [];
}
