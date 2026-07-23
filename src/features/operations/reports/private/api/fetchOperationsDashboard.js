// features/operations/reports/private/api/fetchOperationsDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Dashboard Analytics
 * Source: get_operations_dashboard()
 */
export async function fetchOperationsDashboard({ filters }) {
  const rpcParams = {
    p_start_date: null,
    p_end_date: null,
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

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc(
    "get_operations_dashboard",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
