import { supabase } from "../../../../../lib/supabaseClient";
import { hasRecentPipelineFailures } from "@/features/_shared/checkRecentPipelineFailures";

// Pipelines that feed get_sales_reports_dashboard -- shows the MOST RECENT
// of these last_run_at values as "Last Updated" (changed 2026-08, was
// previously the oldest/weakest-link across all watched pipelines --
// deliberate reversal, see DASHBOARD-ROADMAP.md §6 decision #10).
// sap_payments/sap_payment_applications added 2026-07 (invoice/budget/
// collected rebalance -- the new Cash Collected figures depend on both).
// sap_items added 2026-08 (Top Products chart, topProductsData -- item_code/
// item_name lookup for base_invoice_lines). sap_invoice_lines itself needs
// no separate entry -- it syncs under the sap_invoices pipeline name
// already watched below (see hyrax-data-platform's invoices.py, one
// PIPELINE_NAME covering both OINV and INV1). Keep this list in sync with
// every base CTE in get_sales_reports_dashboard_rpc.sql instead of
// repeating Operations Reports' documented past miss of exactly this kind
// (see DASHBOARD-CONVENTIONS.md).
const SALES_REPORTS_PIPELINE_NAMES = [
  "sap_sales_orders",
  "sap_invoices",
  "sap_payments",
  "sap_payment_applications",
  "sap_items",
];

export async function fetchSalesReportsMetadata() {
  const [owners, pipelineState, hasFailedPipeline] = await Promise.all([
    // Narrowed to Sales-department employees (2026-08) -- this list backs
    // the page's "Salesperson" filter, so it previously listed every
    // employee company-wide (IT/HR/Finance included), most of whom own no
    // sales_leads/sales_rep_code data at all.
    supabase
      .from("employees_public")
      .select("*")
      .eq("department_name", "Sales")
      .order("full_name"),
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
