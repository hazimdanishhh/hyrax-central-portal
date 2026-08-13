import { supabase } from "../../../../../lib/supabaseClient";

// Deliberately a small, self-contained duplicate of the same two queries in
// financeMetadataService.js rather than a cross-domain import -- Sales
// Orders is a Sales-domain feature and shouldn't reach into a Finance
// feature's private/ folder, and sales/reports' own metadata module resolves
// a different identity (CRM employees_public), not sap_sales_persons, so it
// isn't reusable here either.
const SALES_ORDERS_PIPELINE_NAMES = ["sap_sales_orders"];

export async function fetchSalesOrdersMetadata() {
  const [salesReps, pipelineState] = await Promise.all([
    supabase
      .from("sap_sales_persons")
      .select("sales_rep_code, sales_rep_name")
      .eq("is_active", "Y")
      .order("sales_rep_name"),
    supabase
      .from("sap_pipeline_state")
      .select("pipeline_name, last_run_at, last_run_status")
      .in("pipeline_name", SALES_ORDERS_PIPELINE_NAMES),
  ]);

  const pipelineRows = pipelineState.data || [];

  const asOf = pipelineRows.reduce((newest, row) => {
    if (!row.last_run_at) return newest;
    if (!newest || new Date(row.last_run_at) > new Date(newest)) {
      return row.last_run_at;
    }

    return newest;
  }, null);

  const hasFailedPipeline = pipelineRows.some(
    (row) => row.last_run_status === "error",
  );

  return {
    salesReps: salesReps.data || [],
    dataFreshness: { asOf, hasFailedPipeline },
  };
}

/**
 * Search SAP customers for async select
 */
export async function searchSapCustomers(search = "") {
  let query = supabase
    .from("sap_customers")
    .select("customer_code, customer_name")
    .order("customer_name")
    .limit(20);

  if (search?.trim()) {
    query = query.ilike("customer_name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((customer) => ({
    value: customer.customer_code,
    label: customer.customer_name,
  }));
}

/**
 * Get SAP customer by code for async select filter
 */
export async function getSapCustomerByCode(code) {
  if (!code) return null;

  const { data, error } = await supabase
    .from("sap_customers")
    .select("customer_code, customer_name")
    .eq("customer_code", code)
    .single();

  if (error || !data) return null;

  return {
    label: data.customer_name,
    value: data.customer_code,
  };
}
