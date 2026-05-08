import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchProfilesMetadata() {
  const [roles, departments] = await Promise.all([
    supabase.from("roles").select("*").order("name"),
    supabase.from("departments").select("*").order("name"),
  ]);

  return {
    roles: roles.data || [],
    departments: departments.data || [],
  };
}
