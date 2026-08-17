import { supabase } from "../../../../../lib/supabaseClient";

// Employees not yet linked to any profile -- the picker's option list for
// UserEmployeeLink.jsx. Includes the row the profile is ALREADY linked to
// (if any), via the calling hook, so the current link still shows up as a
// selectable/deselectable option rather than disappearing from the list.
export async function fetchUnlinkedEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_id")
    .is("profile_id", null)
    .order("full_name");

  if (error) throw error;

  return data || [];
}

// The employee row (if any) currently linked to a given profile.
export async function fetchLinkedEmployee(profileId) {
  if (!profileId) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

// Atomic link/re-link via the SECURITY DEFINER RPC (supabase/functions/
// link_profile_to_employee.sql) -- clears any previous link, then sets the
// new one, in one transaction. p_employee_id === null means "unlink only".
export async function linkProfileToEmployee({ profileId, employeeId }) {
  const { error } = await supabase.rpc("link_profile_to_employee", {
    p_profile_id: profileId,
    p_employee_id: employeeId,
  });

  if (error) throw error;
}
