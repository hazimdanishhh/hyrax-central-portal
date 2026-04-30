// services/itAssetsServices/itAssetsAnalyticsService.js

import { supabase } from "../../lib/supabaseClient";

export async function fetchITAssetsOverview() {
  const { data, error } = await supabase.from("it_assets").select(`
    id,
    asset_category:asset_category_id (id, name),
    asset_subcategory:asset_subcategory_id (id, name),
    asset_status:asset_status_id (id, name),
    asset_user:asset_user_id (id,full_name,employee_id),
    asset_condition:asset_condition_id (id, name),
    asset_department:asset_department_id (id, name),
    operating_system:operating_system_id (id, name)
  `);

  if (error) throw error;

  return data;
}
