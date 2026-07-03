import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * UPDATE
 */
export async function updateClient(updatedData) {
  const { id, ...rawFields } = updatedData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("clients")
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
export async function bulkUpdateClients(ids, rawFields) {
  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("clients")
    .update(fields)
    .in("id", ids)
    .select("*");

  if (error) throw error;
  return data;
}

/**
 * CREATE
 */
export async function createClient(newData) {
  const { id: _id, ...rawFields } = newData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("clients")
    .insert(fields)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE
 */
export async function deleteClient(id) {
  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) throw error;

  return true;
}

/**
 * BULK DELETE
 */
export async function bulkDeleteClients(ids) {
  const { error } = await supabase.from("clients").delete().in("id", ids);

  if (error) throw error;

  return true;
}
