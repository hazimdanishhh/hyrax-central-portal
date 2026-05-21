import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Search clients for async select
 */
export async function searchClients(search = "") {
  let query = supabase
    .from("clients")
    .select("id, name")
    .order("name")
    .limit(100);

  if (search?.trim()) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((client) => ({
    value: client.id,
    label: client.name,
  }));
}
