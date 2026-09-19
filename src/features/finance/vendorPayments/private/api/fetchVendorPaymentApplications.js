import { supabase } from "../../../../../lib/supabaseClient";
import { fetchAllSupabaseRows } from "../../../../../functions/fetchAllSupabaseRows";

/**
 * Read-only "what was this vendor payment applied to" list, backed by
 * sap_vendor_payment_applications (VPM2) -- AP mirror of
 * sap_payment_applications (RCT2). Join key is payment_ref ->
 * sap_vendor_payments.doc_entry (the only FK to OVPM that exists on this
 * table) -- same RCT2-style join trap as the AR side, see
 * data-dictionary.md.
 *
 * Each row is enriched with `bill` (the resolved sap_vendor_bills row, or
 * null) via the CONFIRMED FK: doc_entry -> sap_vendor_bills.doc_entry, only
 * when doc_type = 18 (OPCH, vendor bill) -- doc_type = 19 (ORPC, A/P credit
 * memo) and other values point at different, unextracted document tables,
 * which is expected, not a bug (see get_finance_dashboard_rpc.sql's "THE
 * VPM2 JOIN TRAP" comment). inv_entry is NOT the bill FK -- its true meaning
 * is undetermined, same caveat as sap_payment_applications.inv_entry on the
 * AR side -- still used for the "On Account"/"Entry #N" fallback label when
 * `bill` doesn't resolve.
 */
export async function fetchVendorPaymentApplications(vendorPaymentDocEntry) {
  if (!vendorPaymentDocEntry) return [];

  // fetchAllSupabaseRows (added 2026-09) rather than a single unbounded
  // .select() -- same latent truncation risk journalEntriesService.js's
  // resolveTransIdsByLineColumn had (confirmed live for a high-volume GL
  // account); low real-world odds for one vendor payment's own
  // applications, but free to keep correct regardless.
  const applications = await fetchAllSupabaseRows(() =>
    supabase
      .from("sap_vendor_payment_applications")
      .select("*")
      .eq("payment_ref", vendorPaymentDocEntry)
      .order("doc_entry", { ascending: true }),
  );

  const billDocEntries = [
    ...new Set(
      applications
        .filter((application) => application.doc_type === 18)
        .map((application) => application.doc_entry),
    ),
  ];

  if (billDocEntries.length === 0) {
    return applications.map((application) => ({ ...application, bill: null }));
  }

  const bills = await fetchAllSupabaseRows(() =>
    supabase
      .from("sap_vendor_bills")
      .select("doc_entry, bill_number, vendor_name, total_amount_myr")
      .in("doc_entry", billDocEntries)
      .order("doc_entry", { ascending: true }),
  );

  const billsByDocEntry = {};
  bills.forEach((bill) => {
    billsByDocEntry[bill.doc_entry] = bill;
  });

  return applications.map((application) => ({
    ...application,
    bill:
      application.doc_type === 18
        ? billsByDocEntry[application.doc_entry] || null
        : null,
  }));
}
