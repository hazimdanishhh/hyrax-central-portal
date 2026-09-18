import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * Normalize a budget_month to the first of its month. get_sales_reports_
 * dashboard's budget_math already date_truncs this defensively, but keep the
 * stored value canonical for consistency with sales_targets.
 *
 * Plain string parsing, not a Date roundtrip -- see
 * salesTargetsMutations.js's normalizeTargetMonth for why (`new Date(...)
 * .getFullYear()/.getMonth()` are LOCAL-time getters against a
 * UTC-midnight date-only string, unsafe for any viewer in a negative UTC
 * offset). budget_month is always already "YYYY-MM-DD" (constructed by
 * monthGrid.js's buildMonthDate on the drill-in page).
 */
function normalizeBudgetMonth(fields) {
  if (!fields.budget_month) return fields;

  const [year, month] = String(fields.budget_month).split("-");

  return { ...fields, budget_month: `${year}-${month}-01` };
}

/**
 * CREATE -- upserts on (sales_rep_code, budget_month) so re-entering an
 * existing rep+month updates that row instead of creating a silent
 * duplicate (see sales_budgets_rep_month_unique constraint).
 */
export async function createSalesBudget(newData) {
  const { id: _id, ...rawFields } = newData;

  const fields = normalizeBudgetMonth(normalizeFields(rawFields));

  const { data, error } = await supabase
    .from("sales_budgets")
    .upsert(fields, { onConflict: "sales_rep_code,budget_month" })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * UPDATE
 */
export async function updateSalesBudget(updatedData) {
  const { id, ...rawFields } = updatedData;

  const fields = normalizeBudgetMonth(normalizeFields(rawFields));

  const { data, error } = await supabase
    .from("sales_budgets")
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
export async function deleteSalesBudget(id) {
  const { error } = await supabase.from("sales_budgets").delete().eq("id", id);

  if (error) throw error;

  return true;
}
