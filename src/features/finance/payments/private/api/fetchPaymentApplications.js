import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only "what was this payment applied to" list, backed by
 * sap_payment_applications (RCT2). Join key is payment_ref =
 * sap_payments.doc_entry (the only FK to ORCT that exists on this table) --
 * NOT receipt_number, see the RCT2 join trap in data-dictionary.md.
 *
 * Each row is enriched with `invoice` (the resolved sap_invoices row, or
 * null) via the CONFIRMED FK: doc_entry -> sap_invoices.doc_entry, filtered
 * inv_type = 13 (doc_entry is a polymorphic FK -- other inv_type values
 * point at different, unextracted document tables, which is expected, not a
 * bug). inv_entry is confirmed NOT the invoice FK -- its true meaning is
 * undetermined (small values like 0-61 suggest a per-application line/
 * sequence number, not a global key) -- still used for the "On Account"/
 * "Entry #N" fallback label when `invoice` doesn't resolve. See
 * data-dictionary.md's "RCT2 -> invoice link" section.
 */
export async function fetchPaymentApplications(paymentDocEntry) {
  if (!paymentDocEntry) return [];

  const { data, error } = await supabase
    .from("sap_payment_applications")
    .select("*")
    .eq("payment_ref", paymentDocEntry);

  if (error) throw error;

  const applications = data || [];

  const invoiceDocEntries = [
    ...new Set(
      applications
        .filter((application) => application.inv_type === 13)
        .map((application) => application.doc_entry),
    ),
  ];

  if (invoiceDocEntries.length === 0) {
    return applications.map((application) => ({
      ...application,
      invoice: null,
    }));
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from("sap_invoices")
    .select("doc_entry, invoice_number, customer_name, total_amount_myr")
    .in("doc_entry", invoiceDocEntries);

  if (invoicesError) throw invoicesError;

  const invoicesByDocEntry = {};
  (invoices || []).forEach((invoice) => {
    invoicesByDocEntry[invoice.doc_entry] = invoice;
  });

  return applications.map((application) => ({
    ...application,
    invoice:
      application.inv_type === 13
        ? invoicesByDocEntry[application.doc_entry] || null
        : null,
  }));
}
