import { supabase } from "../../../../../lib/supabaseClient";
import { formatDate, formatDateTime, formatTime } from "@/functions/formatDate";

/**
 * Fetch a single lead by ID
 */
export async function fetchLeadById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("sales_leads")
    .select(
      `
      *,
      client:client_id(*),
      sap_customer:sap_customers!sap_customer_code(customer_code, customer_name, city, contact_person, phone),
      lead_owner:employees_public!lead_owner_id(*),
      lead_source_type:lead_source_type_id(*)
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
 * Fetch a lead by its PO number -- the reverse of the Sales Order Sidebar's
 * "View Matching Lead" button (sap_sales_orders.customer_ref -> this).
 * po_number is UNIQUE on sales_leads (unlike customer_ref on the SAP side),
 * so this resolves to at most one row -- maybeSingle, not the 0/1/many
 * handling useSalesOrderByPoNumber.js needs for the other direction.
 */
export async function fetchLeadByPoNumber(poNumber) {
  if (!poNumber) return null;

  const { data, error } = await supabase
    .from("sales_leads")
    .select(
      `
      *,
      client:client_id(*),
      sap_customer:sap_customers!sap_customer_code(customer_code, customer_name, city, contact_person, phone),
      lead_owner:employees_public!lead_owner_id(*),
      lead_source_type:lead_source_type_id(*)
    `,
    )
    .eq("po_number", poNumber)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

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
