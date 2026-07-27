// features/finance/reports/private/api/fetchFinanceDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Dashboard Analytics
 * Source: get_finance_dashboard()
 */
export async function fetchFinanceDashboard({ filters }) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_customer_code: null,
    p_sales_rep_code: null,
    p_start_date: null,
    p_end_date: null,
    p_is_cancelled: null,
    p_status_code: null,
    p_vendor_code: null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "customerCode":
        rpcParams.p_customer_code = value === FILTER_NULL ? null : value;
        break;

      // Added 2026-07 (Finance Expansion Phase 1) for the Accounts Payable chain.
      case "vendorCode":
        rpcParams.p_vendor_code = value === FILTER_NULL ? null : value;
        break;

      case "salesRepCode":
        rpcParams.p_sales_rep_code = value === FILTER_NULL ? null : value;
        break;

      case "startDate":
        rpcParams.p_start_date = value;
        break;

      case "endDate":
        rpcParams.p_end_date = value;
        break;

      case "cancelledOnly":
        rpcParams.p_is_cancelled = value === "true" || value === true;
        break;

      case "statusCode":
        rpcParams.p_status_code = value === FILTER_NULL ? null : value;
        break;

      default:
        break;
    }
  });

  const { data, error } = await supabase.rpc(
    "get_finance_dashboard",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
