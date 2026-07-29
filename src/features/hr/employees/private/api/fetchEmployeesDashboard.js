// features/hr/employees/private/api/fetchEmployeesDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Employee Overview dashboard data
 * Source: get_hr_employees_dashboard()
 */
export async function fetchEmployeesDashboard({ filters }) {
  const FILTER_NULL = "__null__";

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
        rpcParams.p_department_id = value === FILTER_NULL ? null : value;
        break;

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc(
    "get_hr_employees_dashboard",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
