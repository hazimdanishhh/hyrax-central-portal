import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Unpaginated fetch of every project category -- a small, shared taxonomy
 * (see get_or_create_project_category.sql), not a per-page paginated list.
 */
export async function fetchProjectCategories() {
  const { data, error } = await supabase
    .from("project_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;

  return data || [];
}

/**
 * Resolves an existing category by (case-insensitive) name, or creates a
 * new one -- backs the "create new on the fly" picker (mirrors Sales'
 * LeadAccountEditor "+ Create new prospect" idea, simpler since a category
 * needs no required side-fields). Race-safety against two people typing
 * the same brand-new name lives in the RPC itself, not here.
 */
export async function getOrCreateProjectCategory(name) {
  const { data, error } = await supabase.rpc("get_or_create_project_category", {
    p_name: name,
  });

  if (error) throw error;

  return data;
}
