import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Fetch a single lead by ID
 */
export async function fetchClientById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("clients")
    .select(
      `
      *,
      industry:industry_id(*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) throw error;

  // We reuse your existing normalizeLeads function.
  // Since it expects an array, we wrap `data` in an array and return the first element.
  return normalizeLeads([data])[0];
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
