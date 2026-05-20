import { supabase } from "../../../../../lib/supabaseClient";

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

  // We reuse your existing normalizeLeads function.
  // Since it expects an array, we wrap `data` in an array and return the first element.
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

function formatDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-MY", {
    dateStyle: "medium",
  });
}

function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-MY", {
    timeStyle: "short",
  });
}
