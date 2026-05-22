import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Search clients for async select
 */
export async function searchClients(search = "") {
  let query = supabase
    .from("clients")
    .select("id, name")
    .order("name")
    .limit(20);

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

/**
 * Get Client by Id for async select filter
 */
export async function getClientById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    label: data.name,
    value: data.id,
  };
}
