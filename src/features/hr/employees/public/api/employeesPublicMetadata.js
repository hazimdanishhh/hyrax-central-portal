import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchEmployeesPublicMetadata() {
  const [managers, departments, nationalities, employmentTypes] =
    await Promise.all([
      supabase
        .from("employees_public")
        .select("id, full_name, employee_id")
        .order("full_name"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("nationalities").select("*").order("name"),
      supabase.from("employment_type").select("*").order("name"),
    ]);

  return {
    managers: managers.data || [],
    departments: departments.data || [],
    nationalities: nationalities.data || [],
    employmentTypes: employmentTypes.data || [],
  };
}
