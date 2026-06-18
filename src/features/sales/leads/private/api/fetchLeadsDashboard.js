// features/sales/leads/private/api/fetchLeadsDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Dashboard Analytics
 * Source: get_sales_leads_dashboard()
 */
export async function fetchLeadsDashboard({ filters }) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_owner_id: null,
    p_client_id: null,
    p_source_id: null,
    p_stage: null,
    p_start_date: null,
    p_end_date: null,
    p_is_on_hold: null,
    p_is_cancelled: null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "owner":
        rpcParams.p_owner_id = value === FILTER_NULL ? null : value;
        break;

      case "client":
        rpcParams.p_client_id = value === FILTER_NULL ? null : value;
        break;

      case "leadSourceType":
        rpcParams.p_source_id = value === FILTER_NULL ? null : value;
        break;

      case "stage":
        rpcParams.p_stage = value === FILTER_NULL ? null : value;
        break;

      case "startDate":
        rpcParams.p_start_date = value;
        break;

      case "endDate":
        rpcParams.p_end_date = value;
        break;

      case "onHold":
        rpcParams.p_is_on_hold = value;
        break;

      case "cancelled":
        rpcParams.p_is_cancelled = value;
        break;

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc(
    "get_sales_leads_dashboard",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
