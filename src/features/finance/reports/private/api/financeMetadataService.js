import { supabase } from "../../../../../lib/supabaseClient";

// Pipelines that feed get_finance_dashboard -- the oldest of these last_run_at
// values is the true "how stale can this dashboard be" bottleneck.
// sap_vendor_bills/sap_vendor_payments added 2026-07 (Finance Expansion
// Phase 1) -- Operations Reports' freshness banner has a documented gap where
// it doesn't watch every table its KPIs depend on; keep this list in sync
// with every base CTE in get_finance_dashboard_rpc.sql instead of repeating
// that mistake here.
const FINANCE_PIPELINE_NAMES = [
  "sap_invoices",
  "sap_sales_orders",
  "sap_payments",
  "sap_payment_applications",
  "sap_vendor_bills",
  "sap_vendor_payments",
];

export async function fetchFinanceMetadata() {
  const [salesReps, pipelineState] = await Promise.all([
    supabase
      .from("sap_sales_persons")
      .select("sales_rep_code, sales_rep_name")
      .eq("is_active", "Y")
      .order("sales_rep_name"),
    supabase
      .from("sap_pipeline_state")
      .select("pipeline_name, last_run_at, last_run_status")
      .in("pipeline_name", FINANCE_PIPELINE_NAMES),
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

/**
 * Search SAP vendors for async select (Finance Expansion Phase 1, 2026-07).
 * sap_customers holds every SAP Business Partner regardless of the table
 * name -- card_type distinguishes customer ('C') vs supplier ('S') vs lead
 * ('L'); filter to 'S' here so this widget only offers vendors.
 */
export async function searchSapVendors(search = "") {
  let query = supabase
    .from("sap_customers")
    .select("customer_code, customer_name")
    .eq("card_type", "S")
    .order("customer_name")
    .limit(20);

  if (search?.trim()) {
    query = query.ilike("customer_name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((vendor) => ({
    value: vendor.customer_code,
    label: vendor.customer_name,
  }));
}

/**
 * Get SAP vendor by code for async select filter
 */
export async function getSapVendorByCode(code) {
  if (!code) return null;

  const { data, error } = await supabase
    .from("sap_customers")
    .select("customer_code, customer_name")
    .eq("customer_code", code)
    .eq("card_type", "S")
    .single();

  if (error || !data) return null;

  return {
    label: data.customer_name,
    value: data.customer_code,
  };
}
