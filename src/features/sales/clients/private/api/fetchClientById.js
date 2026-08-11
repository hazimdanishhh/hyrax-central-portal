import { supabase } from "../../../../../lib/supabaseClient";
import { formatDate, formatDateTime, formatTime } from "@/functions/formatDate";

/**
 * Fetch a single client by ID
 */
export async function fetchClientById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("clients")
    .select(
      `
      *,
      industry:industry_id(*),
      sap_customer:sap_customers!sap_customer_code(customer_code, customer_name, city, contact_person, phone)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  // normalizeClients expects an array, so wrap `data` and take the first element.
  return normalizeClients([data])[0];
}

/**
 * Normalize returned data
 */
function normalizeClients(rows) {
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
