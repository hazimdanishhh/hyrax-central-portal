import { supabase } from "../../../../../lib/supabaseClient";

// Pipelines that feed get_operations_dashboard -- shows the MOST RECENT of
// these last_run_at values as "Last Updated" (changed 2026-08, was
// previously the oldest/weakest-link across all watched pipelines --
// deliberate reversal, see DASHBOARD-ROADMAP.md §6 decision #10).
const OPERATIONS_PIPELINE_NAMES = [
  "sap_sales_orders",
  "sap_deliveries",
  "sap_items",
];

export async function fetchOperationsMetadata() {
  const { data: pipelineRows } = await supabase
    .from("sap_pipeline_state")
    .select("pipeline_name, last_run_at, last_run_status")
    .in("pipeline_name", OPERATIONS_PIPELINE_NAMES);

  const rows = pipelineRows || [];

  const asOf = rows.reduce((newest, row) => {
    if (!row.last_run_at) return newest;
    if (!newest || new Date(row.last_run_at) > new Date(newest)) {
      return row.last_run_at;
    }

    return newest;
  }, null);

  const hasFailedPipeline = rows.some(
    (row) => row.last_run_status === "error",
  );

  return {
    dataFreshness: { asOf, hasFailedPipeline },
  };
}
