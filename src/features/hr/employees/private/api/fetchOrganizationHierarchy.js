// services/fetchOrganizationHierarchy.js
import { supabase } from "../../../../../lib/supabaseClient";

// Raw fetch only -- every employee, any status. Filtering to Active happens
// client-side in useOrganizationHierarchy, not here, so an employee whose
// manager is inactive can still be correctly identified (see that hook).
export async function fetchOrganizationHierarchy() {
  const { data, error } = await supabase.from("employees").select(`
    id,
    employee_id,
    full_name,
    preferred_name,
    position,
    manager_id,
    department_id,
    department:departments (id,name,sub),
    profile:profile_id (avatar_url),
    employment_status:employment_status_id (id,name,category)
  `);

  if (error) throw error;

  return data || [];
}
