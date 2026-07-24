import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only invoice line items, backed by sap_invoice_lines. Joins to
 * sap_items for a human-readable item_name -- there's no item_name column
 * denormalized onto the line table itself.
 *
 * Not enriched with base_entry/base_type (which delivery/order a line came
 * from) in this pass -- that's a documented future enhancement, not needed
 * to show "header + its own lines."
 */
export async function fetchInvoiceLines(invoiceDocEntry) {
  if (!invoiceDocEntry) return [];

  const { data, error } = await supabase
    .from("sap_invoice_lines")
    .select("*, sap_items(item_name)")
    .eq("doc_entry", invoiceDocEntry);

  if (error) throw error;

  return data || [];
}
