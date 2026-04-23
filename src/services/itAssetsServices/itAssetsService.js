// services/itAssetsService.js
import { supabase } from "../../lib/supabaseClient";

/**
 * Service to fetch IT assets for IT department
 * Server-side filtering and pagination
 */
export async function fetchITAssets({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("it_assets")
    .select(
      `
      *,
      asset_category:asset_category_id (id, name),
      asset_subcategory:asset_subcategory_id (id, name, sub, icon),
      asset_status:asset_status_id (id, name),
      asset_user:asset_user_id (id,full_name,employee_id,
        profile:profile_id (id,avatar_url)),
      operating_system:operating_system_id (id, name, icon),
      asset_condition:asset_condition_id (id, name),
      asset_department:asset_department_id (id, name, sub),
      asset_manufacturer:asset_manufacturer_id (id, name)
    `,
      { count: "exact" },
    )
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `asset_name.ilike.%${search}%,asset_code.ilike.%${search}%,serial_number.ilike.%${search}%,asset_model.ilike.%${search}%`,
    );
  }

  // --- FILTERS ---
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;

    const map = {
      category: "asset_category_id",
      subcategory: "asset_subcategory_id",
      status: "asset_status_id",
      condition: "asset_condition_id",
      os: "operating_system_id",
      department: "asset_department_id",
      employees: "asset_user_id",
      mdm: "mdm_status",
      manufacturer: "asset_manufacturer_id",
    };

    if (map[key]) query = query.eq(map[key], value);
  });

  // paginate LAST
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}
