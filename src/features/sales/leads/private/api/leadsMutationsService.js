import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Normalize form values before sending to Supabase
 */
function normalizeFields(rawFields) {
  return Object.fromEntries(
    Object.entries(rawFields)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        // Empty string -> null
        if (value === "") return [key, null];

        // Foreign keys -> integer
        if (key.endsWith("_id") && value !== null) {
          // Async select object
          if (typeof value === "object" && value?.value) {
            return [key, value.value];
          }

          // Numeric string support
          const isNumeric = typeof value === "string" && /^\d+$/.test(value);

          return [key, isNumeric ? Number(value) : value];
        }

        return [key, value];
      }),
  );
}

/**
 * UPDATE
 */
export async function updateLead(updatedData) {
  const { id, ...rawFields } = updatedData;

  const fields = normalizeFields(rawFields);
  console.log(fields);
  const { data, error } = await supabase
    .from("sales_leads")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * BULK UPDATE
 */
export async function bulkUpdateLeads(ids, rawFields) {
  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("sales_leads")
    .update(fields)
    .in("id", ids)
    .select("*");

  if (error) throw error;
  return data;
}

/**
 * CREATE
 */
export async function createLead(newData) {
  const { id, ...rawFields } = newData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("sales_leads")
    .insert(fields)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE
 */
export async function deleteLead(id) {
  const { error } = await supabase.from("sales_leads").delete().eq("id", id);

  if (error) throw error;

  return true;
}

/**
 * BULK DELETE
 */
export async function bulkDeleteLeads(ids) {
  const { error } = await supabase.from("sales_leads").delete().in("id", ids);

  if (error) throw error;

  return true;
}
