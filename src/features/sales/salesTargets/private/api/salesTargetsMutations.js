import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * Normalize a target_month to the first of its month -- this table's own
 * RPC (get_sales_reports_dashboard's pipeline_target_math) uses
 * t.target_month directly without a date_trunc safety net, unlike
 * sales_budgets' budget_math, so the stored value must already be the 1st.
 */
function normalizeTargetMonth(fields) {
  if (!fields.target_month) return fields;

  const date = new Date(fields.target_month);
  const firstOfMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

  return { ...fields, target_month: firstOfMonth };
}

/**
 * CREATE -- upserts on (lead_owner_id, target_month) so re-entering an
 * existing rep+month updates that row instead of creating a silent
 * duplicate (see sales_targets_owner_month_unique constraint).
 */
export async function createSalesTarget(newData) {
  const { id: _id, ...rawFields } = newData;

  const fields = normalizeTargetMonth(normalizeFields(rawFields));

  const { data, error } = await supabase
    .from("sales_targets")
    .upsert(fields, { onConflict: "lead_owner_id,target_month" })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * UPDATE
 */
export async function updateSalesTarget(updatedData) {
  const { id, ...rawFields } = updatedData;

  const fields = normalizeTargetMonth(normalizeFields(rawFields));

  const { data, error } = await supabase
    .from("sales_targets")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE
 */
export async function deleteSalesTarget(id) {
  const { error } = await supabase.from("sales_targets").delete().eq("id", id);

  if (error) throw error;

  return true;
}
