import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchFinanceMetadata() {
  const [salesReps] = await Promise.all([
    supabase
      .from("sap_sales_persons")
      .select("sales_rep_code, sales_rep_name")
      .eq("is_active", "Y")
      .order("sales_rep_name"),
  ]);

  return {
    salesReps: salesReps.data || [],
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
