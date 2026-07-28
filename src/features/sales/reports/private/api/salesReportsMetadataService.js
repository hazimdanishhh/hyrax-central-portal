import { supabase } from "../../../../../lib/supabaseClient";

// Pipelines that feed get_sales_reports_dashboard -- the oldest of these
// last_run_at values is the true "how stale can this dashboard be" bottleneck.
// sap_payments/sap_payment_applications added 2026-07 (invoice/budget/
// collected rebalance -- the new Cash Collected figures depend on both).
// Keep this list in sync with every base CTE in
// get_sales_reports_dashboard_rpc.sql instead of repeating Operations
// Reports' documented past miss of exactly this kind (see
// DASHBOARD-CONVENTIONS.md).
const SALES_REPORTS_PIPELINE_NAMES = [
  "sap_sales_orders",
  "sap_invoices",
  "sap_payments",
  "sap_payment_applications",
];

export async function fetchSalesReportsMetadata() {
  const [owners, pipelineState] = await Promise.all([
    supabase.from("employees_public").select("*").order("full_name"),
    supabase
      .from("sap_pipeline_state")
      .select("pipeline_name, last_run_at, last_run_status")
      .in("pipeline_name", SALES_REPORTS_PIPELINE_NAMES),
  ]);

  const pipelineRows = pipelineState.data || [];

  const asOf = pipelineRows.reduce((oldest, row) => {
    if (!row.last_run_at) return oldest;
    if (!oldest || new Date(row.last_run_at) < new Date(oldest)) {
      return row.last_run_at;
    }

    return oldest;
  }, null);

  const hasFailedPipeline = pipelineRows.some(
    (row) => row.last_run_status === "error",
  );

  return {
    owners: owners.data || [],
    dataFreshness: { asOf, hasFailedPipeline },
  };
}
