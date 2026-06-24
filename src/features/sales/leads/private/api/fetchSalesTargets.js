import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Prorated Sales Targets
 * Source: get_sales_targets_prorated()
 */
export async function fetchSalesTargets({ filters }) {
  const FILTER_NULL = "__null__";

  const rpcParams = {
    p_owner_id: null,
    p_start_date: null,
    p_end_date: null,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "owner":
        rpcParams.p_owner_id = value === FILTER_NULL ? null : value;
        break;

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
    "get_sales_targets_prorated",
    rpcParams,
  );

  if (error) throw error;

  return data;
}
