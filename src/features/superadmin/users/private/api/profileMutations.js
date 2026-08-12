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
 * Removes the profiles row only, by design (confirmed 2026-08) — Auth
 * account lifecycle (create/disable/delete) is explicitly out of scope for
 * this app; user provisioning/deprovisioning is handled entirely through
 * Google Admin. This page's CRUD surface is Read/Update/Delete on
 * `profiles` only.
 */
export async function deleteProfile(id) {
  const { error } = await supabase.from("profiles").delete().eq("id", id);

  if (error) throw error;

  return true;
}
