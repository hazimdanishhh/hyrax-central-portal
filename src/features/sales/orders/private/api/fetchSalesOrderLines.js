import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only sales order line items, backed by sap_sales_order_lines. Joins
 * to sap_items for a human-readable item_name -- there's no item_name
 * column denormalized onto the line table itself.
 */
export async function fetchSalesOrderLines(orderDocEntry) {
  if (!orderDocEntry) return [];

  const { data, error } = await supabase
    .from("sap_sales_order_lines")
    .select("*, sap_items(item_name)")
    .eq("doc_entry", orderDocEntry);

  if (error) throw error;

  return data || [];
}
