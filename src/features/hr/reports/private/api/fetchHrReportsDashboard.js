// features/hr/reports/private/api/fetchHrReportsDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * HR Reports dashboard data
 * Source: get_hr_reports_dashboard()
 */
export function buildHrReportsDashboardParams(filters) {
  const rpcParams = {
    p_start_date: null,
    p_end_date: null,
    p_department_id: null,
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

      case "department":
        rpcParams.p_department_id = value;
        break;

      default:
        break;
    }
  });

  return rpcParams;
}

export async function fetchHrReportsDashboard({ filters }) {
  const rpcParams = buildHrReportsDashboardParams(filters);

  const { data, error } = await supabase.rpc(
    "get_hr_reports_dashboard",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
