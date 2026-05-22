// services/salesLeadServices/leadsOverview.js

import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchLeadsOverview() {
  const { data, error } = await supabase.from("sales_leads").select(`
      id,
      title,
      stage,
      expected_revenue,
      close_probability,
      is_on_hold,
      is_cancelled,
      created_at,

      client:client_id (
        id,
        name
      ),

      lead_owner:lead_owner_id (
        id,
        full_name,
        employee_id
      ),

      lead_source:lead_source_type_id (
        id,
        name
      )
    `);

  if (error) throw error;

  return data;
}
