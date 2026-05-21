// features/it/assets/private/api/itAssetMutations.js
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
export async function updateAsset(updatedData) {
  const { id, ...rawFields } = updatedData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("it_assets")
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
export async function bulkUpdateAssets(ids, rawFields) {
  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("it_assets")
    .update(fields)
    .in("id", ids)
    .select("*");

  if (error) throw error;

  return data;
}

/**
 * CREATE
 */
export async function createAsset(newData) {
  const { id, ...rawFields } = newData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("it_assets")
    .insert(fields)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE
 */
export async function deleteAsset(id) {
  const { error } = await supabase.from("it_assets").delete().eq("id", id);

  if (error) throw error;

  return true;
}

/**
 * BULK DELETE
 */
export async function bulkDeleteAssets(ids) {
  const { error } = await supabase.from("it_assets").delete().in("id", ids);

  if (error) throw error;

  return true;
}
