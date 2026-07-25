import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only "what was this payment applied to" list, backed by
 * sap_payment_applications (RCT2). Join key is payment_ref =
 * sap_payments.doc_entry (the only FK to ORCT that exists on this table) --
 * NOT receipt_number, see the RCT2 join trap in data-dictionary.md.
 *
 * inv_entry/inv_type are returned raw, NOT resolved to an invoice number.
 * Which column is the real FK to the invoice is a disputed, unresolved
 * question -- see data-dictionary.md's "RCT2 -> invoice link" section:
 *   - This pipeline has assumed inv_entry = sap_invoices.doc_entry.
 *   - hyrax-data-platform/docs/sap-data-architecture-plans/01-sap-schema-
 *     relationships.md (fresh SAP schema research, treated as source of
 *     truth for the target model) instead says doc_entry is the real FK.
 *   - Neither is confirmed: the empirical check that produced this comment
 *     found live inv_entry values (0-61) too small to be real invoice keys,
 *     which argues against the inv_entry assumption but doesn't confirm
 *     doc_entry either. Needs verifying against an actual SAP B1 Incoming
 *     Payment record's Invoices tab, not something to guess at further here.
 * Show the raw values honestly rather than a possibly-wrong resolved
 * invoice number.
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
