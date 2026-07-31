import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Unpaginated fetch of every active employees_public row -- for building a
 * client-side org tree (see buildOrganizationTree.js), not for a paginated
 * directory list (see employeesPublic.js's fetchEmployeesPublic for that).
 */
export async function fetchAllEmployeesPublic() {
  // "Active" for directory/org-structure purposes = the canonical active
  // bucket (Active/Probation/On Leave/Sabbatical) PLUS Terminated Notice --
  // someone serving notice is still physically at work (see
  // employment_status_category_migration.sql) -- same convention every
  // other public-directory query in this codebase already uses.
  const { data, error } = await supabase
    .from("employees_public")
    .select("*")
    .or(
      "employment_status_category.eq.active,employment_status_name.eq.Terminated Notice",
    );

  if (error) throw error;

  return data || [];
}
