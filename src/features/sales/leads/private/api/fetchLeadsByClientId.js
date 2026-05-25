import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Fetch all leads by Client ID
 */
export async function fetchLeadsByClientId(clientId) {
  if (!clientId || clientId === "new") return [];

  const { data, error } = await supabase
    .from("sales_leads")
    .select(
      `
      *,
      client:client_id(*),
      client_contact:client_contact_id(*),
      lead_owner:employees_public!lead_owner_id(*),
      lead_source_type:lead_source_type_id(*)
    `,
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  // We reuse your existing normalizeLeads function.
  // Since it expects an array, we wrap `data` in an array and return the first element.
  return normalizeLeads(data || []);
}

/**
 * Normalize returned data
 */
function normalizeLeads(rows) {
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
