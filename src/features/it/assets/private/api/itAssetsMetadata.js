import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchITAssetsMetadata() {
  const [
    categories,
    subcategories,
    conditions,
    manufacturers,
    operatingSystems,
    statuses,
    departments,
    employees,
  ] = await Promise.all([
    supabase.from("it_asset_category").select("*").order("name"),
    supabase.from("it_asset_subcategory").select("*").order("name"),
    supabase.from("it_asset_condition").select("*").order("name"),
    supabase.from("it_asset_manufacturer").select("*").order("name"),
    supabase.from("it_asset_operating_system").select("*").order("name"),
    supabase.from("it_asset_status").select("*").order("name"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("employees_public").select("*").order("full_name"),
  ]);

  return {
    categories: categories.data || [],
    subcategories: subcategories.data || [],
    conditions: conditions.data || [],
    manufacturers: manufacturers.data || [],
    operatingSystems: operatingSystems.data || [],
    statuses: statuses.data || [],
    departments: departments.data || [],
    employees: employees.data || [],
  };
}
