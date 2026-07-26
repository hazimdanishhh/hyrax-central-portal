import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only "what was this payment applied to" list, backed by
 * sap_payment_applications (RCT2). Join key is payment_ref =
 * sap_payments.doc_entry (the only FK to ORCT that exists on this table) --
 * NOT receipt_number, see the RCT2 join trap in data-dictionary.md.
 *
 * inv_entry/inv_type/doc_entry are returned raw, NOT resolved to an invoice
 * number here. The real FK to the invoice is now CONFIRMED: doc_entry ->
 * sap_invoices.doc_entry, filtered inv_type = 13 (doc_entry is a polymorphic
 * FK -- other inv_type values point at different, unextracted document
 * tables, which is expected, not a bug). inv_entry is confirmed NOT the
 * invoice FK -- its true meaning is undetermined (small values like 0-61
 * suggest a per-application line/sequence number, not a global key). See
 * data-dictionary.md's "RCT2 -> invoice link" section. Resolving this into a
 * displayed invoice_number (join sap_invoices on doc_entry + inv_type=13,
 * left-join to leave non-invoice rows blank) is a small, now-unblocked
 * follow-up -- not done yet, so raw values are still shown here.
 */
export async function fetchPaymentApplications(paymentDocEntry) {
  if (!paymentDocEntry) return [];

  const { data, error } = await supabase
    .from("sap_payment_applications")
    .select("*")
    .eq("payment_ref", paymentDocEntry);

  if (error) throw error;

  return data || [];
}
