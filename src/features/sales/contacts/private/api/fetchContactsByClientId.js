import { supabase } from "../../../../../lib/supabaseClient";
import { formatDate, formatDateTime, formatTime } from "@/functions/formatDate";

/**
 * Fetch all contacts by client ID
 */
export async function fetchContactsByClientId(clientId) {
  if (!clientId || clientId === "new") return [];

  const { data, error } = await supabase
    .from("client_contacts")
    .select(`*, client:client_id(*)`)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return normalizeContacts(data || []);
}

/**
 * Normalize returned data
 */
function normalizeContacts(rows) {
  return rows.map((activity) => ({
    ...activity,

    created_at: formatDateTime(activity.created_at),
    updated_at: formatDateTime(activity.updated_at),

    created_date: formatDate(activity.created_at),
    created_time: formatTime(activity.created_at),

    updated_date: formatDate(activity.updated_at),
    updated_time: formatTime(activity.updated_at),
  }));
}
