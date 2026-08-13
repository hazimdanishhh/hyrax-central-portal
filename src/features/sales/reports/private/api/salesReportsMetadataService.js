import { supabase } from "../../../../../lib/supabaseClient";
import { hasRecentPipelineFailures } from "@/features/_shared/checkRecentPipelineFailures";

// Pipelines that feed get_sales_reports_dashboard -- shows the MOST RECENT
// of these last_run_at values as "Last Updated" (changed 2026-08, was
// previously the oldest/weakest-link across all watched pipelines --
// deliberate reversal, see DASHBOARD-ROADMAP.md §6 decision #10).
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
  const [owners, pipelineState, hasFailedPipeline] = await Promise.all([
    supabase.from("employees_public").select("*").order("full_name"),
    supabase
      .from("sap_pipeline_state")
      .select("pipeline_name, last_run_at")
      .in("pipeline_name", SALES_REPORTS_PIPELINE_NAMES),
    hasRecentPipelineFailures(SALES_REPORTS_PIPELINE_NAMES),
  ]);

  const pipelineRows = pipelineState.data || [];

  const asOf = pipelineRows.reduce((newest, row) => {
    if (!row.last_run_at) return newest;
    if (!newest || new Date(row.last_run_at) > new Date(newest)) {
      return row.last_run_at;
    }

    return newest;
  }, null);

  return {
    owners: owners.data || [],
    dataFreshness: { asOf, hasFailedPipeline },
  };
}
