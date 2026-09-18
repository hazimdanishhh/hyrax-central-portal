import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * Normalize a target_month to the first of its month -- this table's own
 * RPC (get_sales_reports_dashboard's pipeline_target_math) uses
 * t.target_month directly without a date_trunc safety net, unlike
 * sales_budgets' budget_math, so the stored value must already be the 1st.
 *
 * Plain string parsing, not a Date roundtrip -- `new Date(...).getFullYear()/
 * .getMonth()` are LOCAL-time getters against a UTC-midnight date-only
 * string, which silently rolls back a day for any viewer in a negative UTC
 * offset. target_month is always already "YYYY-MM-DD" (constructed by
 * monthGrid.js's buildMonthDate on the drill-in page), so this only ever
 * needs to force the day segment, never re-derive year/month from a Date.
 */
function normalizeTargetMonth(fields) {
  if (!fields.target_month) return fields;

  const [year, month] = String(fields.target_month).split("-");

  return { ...fields, target_month: `${year}-${month}-01` };
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
