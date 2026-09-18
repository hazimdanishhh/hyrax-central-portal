import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Deliberately UNPAGINATED -- mirrors tasksByProjectService.js's own
 * precedent. sales_targets is a small settings-style table (one row per
 * active rep per month); the master grouped-list view (SalesTargetsManagement.jsx)
 * needs the whole table to group client-side by (lead_owner_id, year), not
 * a server-paginated page of it. See groupRowsByRepYear.js for why grouping
 * itself stays client-side rather than a new RPC.
 */
export async function fetchAllSalesTargets() {
  const { data, error } = await supabase
    .from("sales_targets")
    .select("*, employee:lead_owner_id (id, full_name)")
    .order("target_month", { ascending: false });

  if (error) throw error;

  return data || [];
}
