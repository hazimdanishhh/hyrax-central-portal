import { supabase } from "../../../../../lib/supabaseClient";

// Unpaginated fetch for the Users Overview tab -- small dataset (system
// users, not a business-transaction table), same "flat client-side
// computed KPIs" pattern as itAssetsOverview.js, no RPC needed.
export async function fetchProfilesOverview() {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, full_name, email, department_id, created_at,
       department:department_id(id,name,sub)`,
    )
    .order("full_name");

  if (error) throw error;

  // employees.profile_id has no reverse FK exposed on profiles -- fetch the
  // set of linked profile ids separately to compute "not linked" client-side.
  const { data: linked, error: linkedError } = await supabase
    .from("employees")
    .select("profile_id")
    .not("profile_id", "is", null);

  if (linkedError) throw linkedError;

  const linkedProfileIds = new Set((linked || []).map((e) => e.profile_id));

  return (data || []).map((p) => ({
    ...p,
    isLinkedToEmployee: linkedProfileIds.has(p.id),
  }));
}
