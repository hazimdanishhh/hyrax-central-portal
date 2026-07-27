import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Eager-fetch the (small, mostly-static) list of active SAP sales reps --
 * same query financeMetadataService.js already runs for its salesRepCode
 * filter. A plain select dropdown, not asyncSelect -- the list is short
 * enough that search-as-you-type isn't needed.
 */
export async function fetchSalesBudgetsMetadata() {
  const { data, error } = await supabase
    .from("sap_sales_persons")
    .select("sales_rep_code, sales_rep_name")
    .eq("is_active", "Y")
    .order("sales_rep_name");

  if (error) throw error;

  return {
    salesReps: data || [],
  };
}
