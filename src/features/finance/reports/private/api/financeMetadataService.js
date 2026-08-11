import { supabase } from "../../../../../lib/supabaseClient";

// Pipelines that feed get_finance_dashboard -- the oldest of these last_run_at
// values is the true "how stale can this dashboard be" bottleneck.
// sap_vendor_bills/sap_vendor_payments added 2026-07 (Finance Expansion
// Phase 1); sap_oact/sap_gl_journal_entries added 2026-07 (Phase 2);
// sap_odsc/sap_dsc1/sap_obnk added 2026-08 (Phase 3, Cash Flow Statement) --
// Operations Reports' freshness banner has a documented gap where it doesn't
// watch every table its KPIs depend on; keep this list in sync with every
// base CTE in get_finance_dashboard_rpc.sql instead of repeating that
// mistake here. sap_oact/sap_odsc/sap_dsc1/sap_obnk are dimensions.py's
// per-table watermark names (folded into the "dimensions" full-refresh loop
// alongside sap_oitm/sap_ocrd/sap_oslp -- each written as f"sap_{name}", not
// the human-readable Supabase table name); sap_gl_journal_entries is
// gl_journal.py's own PIPELINE_NAME. sap_item_warehouse_stock (OITW, Phase 4)
// deliberately NOT added -- Finance's dio/cashConversionCycle are GL-derived
// and don't consume that table at all.
const FINANCE_PIPELINE_NAMES = [
  "sap_invoices",
  "sap_sales_orders",
  "sap_payments",
  "sap_payment_applications",
  "sap_vendor_bills",
  "sap_vendor_payments",
  "sap_oact",
  "sap_gl_journal_entries",
  "sap_odsc",
  "sap_dsc1",
  "sap_obnk",
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
