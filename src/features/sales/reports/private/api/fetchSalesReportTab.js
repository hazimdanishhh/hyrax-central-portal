// features/sales/reports/private/api/fetchSalesReportTab.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * One Sales Reports tab's data (2026-10-22). Every tab RPC takes the same
 * three arguments -- the period and the salesperson from the page's URL --
 * and returns { meta, kpis, ...datasets } built from the shared metric
 * layer (hyrax-supabase/archive/portal/supabase/sql_editor/sales_metric_*.sql), so one fetcher serves all
 * of them. See docs/sales/SALES-REPORTS-TABS-PLAN.md.
 *
 * Empty filter values are sent as null: no dates = the RPC's default (the
 * full current month), no owner = everyone.
 */
export const SALES_REPORT_RPCS = {
  summary: "get_sales_summary",
  pipeline: "get_sales_pipeline",
  orders: "get_sales_orders",
  invoicing: "get_sales_invoicing",
  collections: "get_sales_collections",
  team: "get_sales_team",
};

export async function fetchSalesReportTab(tab, filters = {}) {
  const rpc = SALES_REPORT_RPCS[tab];
  if (!rpc) throw new Error(`Unknown Sales Reports tab: ${tab}`);

  const { data, error } = await supabase.rpc(rpc, {
    p_start_date: filters.startDate || null,
    p_end_date: filters.endDate || null,
    p_owner_id: filters.owner || null,
  });

  if (error) throw error;

  return data;
}
