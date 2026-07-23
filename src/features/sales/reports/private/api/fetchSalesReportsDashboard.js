// features/sales/reports/private/api/fetchSalesReportsDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Dashboard Analytics
 * Source: get_sales_reports_dashboard()
 *
 * Deliberately a separate RPC from get_sales_leads_dashboard (Leads
 * Overview's Tier-2 dashboard) -- this one serves the Tier-3 departmental
 * Reports page. See docs/DEPARTMENT-DASHBOARD-BLUEPRINT.md §5.1.
 */
export async function fetchSalesReportsDashboard({ filters }) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_start_date: null,
    p_end_date: null,
    p_owner_id: null,
    p_product_type: null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "startDate":
        rpcParams.p_start_date = value;
        break;

      case "endDate":
        rpcParams.p_end_date = value;
        break;

      case "owner":
        rpcParams.p_owner_id = value === FILTER_NULL ? null : value;
        break;

      case "productType":
        rpcParams.p_product_type = value === FILTER_NULL ? null : value;
        break;

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc(
    "get_sales_reports_dashboard",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
