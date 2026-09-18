import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Deliberately UNPAGINATED -- mirrors salesTargetsService.js's own
 * fetchAllSalesTargets. sales_budgets is a small settings-style table (one
 * row per active rep per month); the master grouped-list view
 * (SalesBudgetsManagement.jsx) needs the whole table to group client-side
 * by (sales_rep_code, year), not a server-paginated page of it.
 */
export async function fetchAllSalesBudgets() {
  const { data, error } = await supabase
    .from("sales_budgets")
    .select("*, sales_rep:sales_rep_code (sales_rep_code, sales_rep_name)")
    .order("budget_month", { ascending: false });

  if (error) throw error;

  return data || [];
}
