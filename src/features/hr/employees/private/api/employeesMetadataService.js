import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchEmployeesMetadata() {
  const [
    managers,
    profiles,
    departments,
    nationalities,
    identificationTypes,
    employmentTypes,
    terminationReasons,
    employmentStatuses,
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, employee_id")
      .order("full_name"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("nationalities").select("*").order("name"),
    supabase.from("identification_type").select("*").order("name"),
    supabase.from("employment_type").select("*").order("name"),
    supabase.from("termination_reason").select("*").order("name"),
    supabase.from("employment_status").select("*").order("name"),
  ]);

  return {
    managers: managers.data || [],
    profiles: profiles.data || [],
    departments: departments.data || [],
    nationalities: nationalities.data || [],
    identificationTypes: identificationTypes.data || [],
    employmentTypes: employmentTypes.data || [],
    terminationReasons: terminationReasons.data || [],
    employmentStatuses: employmentStatuses.data || [],
  };
}
