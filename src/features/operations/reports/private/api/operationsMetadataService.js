import { supabase } from "../../../../../lib/supabaseClient";

// Pipelines that feed get_operations_dashboard -- the oldest of these
// last_run_at values is the true "how stale can this dashboard be" bottleneck.
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

  const asOf = rows.reduce((oldest, row) => {
    if (!row.last_run_at) return oldest;
    if (!oldest || new Date(row.last_run_at) < new Date(oldest)) {
      return row.last_run_at;
    }

    return oldest;
  }, null);

  const hasFailedPipeline = rows.some(
    (row) => row.last_run_status === "error",
  );

  return {
    dataFreshness: { asOf, hasFailedPipeline },
  };
}
