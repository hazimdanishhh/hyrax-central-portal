import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only "what was this payment applied to" list, backed by
 * sap_payment_applications (RCT2). Join key is payment_ref =
 * sap_payments.doc_entry (the only FK that exists on this table) -- NOT
 * receipt_number, see the RCT2 join trap in DATA-DICTIONARY.md.
 *
 * inv_entry/inv_type are returned raw, NOT resolved to an invoice number.
 * The data dictionary and pipeline docs claim inv_entry = sap_invoices.doc_entry,
 * but live data doesn't bear that out (inv_entry values 0-61 don't match any
 * real sap_invoices.doc_entry or invoice_number) -- open question, needs
 * verifying against an actual SAP B1 Incoming Payment record's Invoices tab,
 * not something to guess at further here. Show the raw values honestly
 * rather than a possibly-wrong resolved invoice number.
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
