// features/sales/leads/private/api/fetchLeadsDashboard.js

import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Leads Overview figures: get_sales_leads_dashboard (rebuilt 2026-10-23 on
 * the shared Sales metric layer). It takes the period and the salesperson
 * only (DASHBOARD-CONVENTIONS §8 R13); empty dates = the current month,
 * like every report.
 */
export async function fetchLeadsDashboard({ startDate, endDate, owner }) {
  const { data, error } = await supabase.rpc("get_sales_leads_dashboard", {
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_owner_id: owner || null,
  });

  if (error) throw error;
  return data;
}
