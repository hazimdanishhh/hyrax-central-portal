import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchSubordinatesPublicById(employeeId) {
  if (!employeeId) return null;

  // "Active" for directory purposes = the canonical active bucket
  // (Active/Probation/On Leave/Sabbatical) PLUS Terminated Notice --
  // someone serving notice is still physically at work and belongs in a
  // people-picker (see employment_status_category_migration.sql).
  const { data, error } = await supabase
    .from("employees_public")
    .select("*")
    .eq("manager_id", employeeId)
    .or(
      "employment_status_category.eq.active,employment_status_name.eq.Terminated Notice",
    )
    .order("full_name");

  if (error) throw error;

  return data;
}
