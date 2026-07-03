import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * UPDATE
 *
 * No `createProfile` here: profiles are only ever created automatically by
 * AuthContext's syncProfile() on first login (id must match an existing
 * Supabase Auth user), so there's no valid manual "create" target.
 */
export async function updateProfile(updatedData) {
  const { id, ...rawFields } = updatedData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE
 *
 * Removes the profiles row only. This does NOT remove the corresponding
 * Supabase Auth account (that requires the service-role admin API, which
 * must not run client-side) — the deleted user's auth account remains valid
 * until a proper offboarding flow (e.g. an Edge Function) exists.
 */
export async function deleteProfile(id) {
  const { error } = await supabase.from("profiles").delete().eq("id", id);

  if (error) throw error;

  return true;
}
