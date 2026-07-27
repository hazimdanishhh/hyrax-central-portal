import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only vendor bill line items, backed by sap_vendor_bill_lines. Joins to
 * sap_items for a human-readable item_name -- there's no item_name column
 * denormalized onto the line table itself.
 *
 * Not enriched with base_entry/base_type (which goods receipt/purchase order
 * a line came from) in this pass -- that's a documented future enhancement,
 * not needed to show "header + its own lines."
 */
export async function fetchBillLines(billDocEntry) {
  if (!billDocEntry) return [];

  const { data, error } = await supabase
    .from("sap_vendor_bill_lines")
    .select("*, sap_items(item_name)")
    .eq("doc_entry", billDocEntry);

  if (error) throw error;

  return data || [];
}
