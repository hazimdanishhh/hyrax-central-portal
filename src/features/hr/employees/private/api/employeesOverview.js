// services/employeeServices/employeeAnalyticsService.js
import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchEmployeesOverview() {
  const { data, error } = await supabase.from("employees").select(`
    id,full_name,employee_id,gender,
    profile:profile_id (*),
    identification_type:identification_type_id (id,name),
    nationality:nationality_id (id,name),
    department:departments (id,name,sub),
    manager:manager_id (id,employee_id,full_name),
    employment_status:employment_status_id (id,name),
    employment_type:employment_type_id (id,name),
    termination_reason:termination_reason_id (id,name)
  `);

  if (error) throw error;

  return data;
}
