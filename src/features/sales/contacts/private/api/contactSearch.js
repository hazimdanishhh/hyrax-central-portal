import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Search clients for async select
 */
export async function searchContacts(search = "", clientId = null) {
  let query = supabase
    .from("client_contacts")
    .select("id, full_name, client_id")
    .order("full_name")
    .limit(20);

  if (search?.trim()) {
    query = query.ilike("full_name", `%${search}%`);
  }

  // filter by selected client
  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((contact) => ({
    value: contact.id,
    label: contact.full_name,
  }));
}

/**
 * Get Contact by Id for async select filter
 */
export async function getContactById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("client_contacts")
    .select("id, full_name")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    label: data.full_name,
    value: data.id,
  };
}
