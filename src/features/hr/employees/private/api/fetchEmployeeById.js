// services/fetchEmployeeById.js
import { supabase } from "../../../../../lib/supabaseClient";

// Full-detail single-record fetch -- same select shape as employeesService.js's
// fetchEmployees, scoped to one id. Used wherever a consumer (e.g. the
// Organization Chart's node sidebar) only has the leaner bulk-list/bulk-tree
// shape and needs the complete record for editing via employeesTableConfig.
export async function fetchEmployeeById(id) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("employees")
    .select(
      `
        *,
        profile:profile_id (*),
        identification_type:identification_type_id (id,name),
        nationality:nationality_id (id,name),
        department:departments (id,name,sub),
        manager:manager_id (id,employee_id,full_name,preferred_name,email_work,phone_work,position,
          department:departments (id,name,sub)),
        employment_status:employment_status_id (id,name),
        employment_type:employment_type_id (id,name),
        termination_reason:termination_reason_id (id,name
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
}
