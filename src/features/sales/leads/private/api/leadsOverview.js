// services/salesLeadServices/leadsOverview.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * lead_owner embeds employees_public, not employees -- matches
 * leadsService.js/fetchLeadById.js/fetchLeadsByClientId.js's existing
 * `employees_public!lead_owner_id(*)` pattern. The raw `employees` table's
 * RLS is HR-scoped (self/manager/HR/superadmin), and this was previously an
 * inner-join-shaped embed, so a Sales/MGM viewer's RLS against it didn't
 * just null the name -- it silently dropped the whole lead from this
 * Overview.
 */
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

      sap_customer:sap_customers!sap_customer_code (
        customer_code,
        customer_name
      ),

      lead_owner:employees_public!lead_owner_id (
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
