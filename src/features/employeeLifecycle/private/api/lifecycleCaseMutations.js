import { supabase } from "../../../../lib/supabaseClient";

/**
 * Case-level metadata edit -- expected_last_day, employee_can_view, and
 * (the "Manual status override" design) status itself, a plain editable
 * field gated HR + superadmin only by RLS, following the projects.status
 * precedent. Same shape as every other mutation file: destructure
 * {data,error}, throw on error, return the row -- no classes, no try/catch.
 */
export async function updateLifecycleCase({ id, ...fields }) {
  const { data, error } = await supabase
    .from("employee_lifecycle_cases")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * The only item-level write client code ever performs -- derived items
 * (class: "DERIVED" in onboardingChecklistMeta.js/offboardingChecklistMeta.js)
 * are never targeted by this from the UI; ChecklistItemCard's canActOnItem
 * gate already prevents the button from rendering for them, and RLS's
 * owning-department-only UPDATE policy would reject a stray attempt
 * anyway. completed_by/completed_at are set here (not left to a trigger)
 * since a manual item completion has a real human actor to attribute.
 */
export async function updateChecklistItemStatus({ id, status, notes, actingProfileId }) {
  const fields = { status, notes: notes ?? null };
  if (status === "DONE") {
    fields.completed_at = new Date().toISOString();
    fields.completed_by = actingProfileId ?? null;
  } else {
    fields.completed_at = null;
    fields.completed_by = null;
  }

  const { data, error } = await supabase
    .from("employee_lifecycle_case_items")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}
