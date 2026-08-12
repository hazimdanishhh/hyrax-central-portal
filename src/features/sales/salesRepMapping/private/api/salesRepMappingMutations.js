import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * UPDATE only -- rows are trigger-managed
 * (auto_create_sales_rep_mapping.sql, fired on sap_sales_persons INSERT).
 * employee_id is the one manually-assigned column; there's no valid
 * create/delete target here.
 */
export async function updateSalesRepMapping({ sales_rep_code, employee_id }) {
  const fields = normalizeFields({ employee_id });

  const { data, error } = await supabase
    .from("employee_sales_rep_mapping")
    .update(fields)
    .eq("sales_rep_code", sales_rep_code)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}
