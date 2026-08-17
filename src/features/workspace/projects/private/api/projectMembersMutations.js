import { supabase } from "../../../../../lib/supabaseClient";

/**
 * The load-bearing junction-table pattern this module introduces -- no
 * prior precedent in this schema (every existing "assignment" elsewhere in
 * this app is a single-owner FK column, not a true many-to-many). A
 * multi-select field's value is an array, which normalizeFields.js was
 * never built to unwrap into insert/delete calls against a separate
 * table -- so membership changes are diffed and synced here explicitly,
 * never routed through a plain `.update()`.
 *
 * `roleAssignments` is `[{ employeeId, role }]` for every non-owner member
 * the caller wants the project to end up with. The current owner's row is
 * never touched by this function -- ownership only ever moves via
 * transferProjectOwnership (see projectMutations.js) -- callers should
 * exclude the owner from `roleAssignments` entirely.
 */
export async function syncProjectMembers(projectId, roleAssignments) {
  const { data: current, error: fetchError } = await supabase
    .from("project_members")
    .select("employee_id, role")
    .eq("project_id", projectId);

  if (fetchError) throw fetchError;

  const currentByEmployee = new Map(current.map((m) => [m.employee_id, m.role]));

  const toAdd = roleAssignments.filter((a) => !currentByEmployee.has(a.employeeId));

  const toUpdateRole = roleAssignments.filter((a) => {
    const existingRole = currentByEmployee.get(a.employeeId);
    return (
      existingRole !== undefined &&
      existingRole !== a.role &&
      existingRole !== "owner" && // owner's row is never touched here
      a.role !== "owner"
    );
  });

  const nextIds = new Set(roleAssignments.map((a) => a.employeeId));
  const toRemove = [...currentByEmployee.keys()].filter(
    (employeeId) => !nextIds.has(employeeId) && currentByEmployee.get(employeeId) !== "owner",
  );

  if (toAdd.length) {
    const { error } = await supabase
      .from("project_members")
      .insert(toAdd.map((a) => ({ project_id: projectId, employee_id: a.employeeId, role: a.role })));
    if (error) throw error;
  }

  for (const a of toUpdateRole) {
    const { error } = await supabase
      .from("project_members")
      .update({ role: a.role })
      .eq("project_id", projectId)
      .eq("employee_id", a.employeeId);
    if (error) throw error;
  }

  if (toRemove.length) {
    // Surfaces block_owner_removal_from_project_members() /
    // block_project_member_removal_with_active_tasks()'s specific,
    // friendly exception messages via getFriendlyError's default
    // (raw err.message) fallback -- neither is a generic Postgres error
    // code, so getFriendlyError's constraint map doesn't need entries for
    // them.
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .in("employee_id", toRemove);
    if (error) throw error;
  }
}

/** Single-row removal, used by the Members tab's per-row "Remove" action
 * (rather than routing a lone removal through the full sync/diff above). */
export async function removeProjectMember(projectId, employeeId) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("employee_id", employeeId);

  if (error) throw error;

  return true;
}

/** Single-row role change (e.g. promoting a member to lead), used by the
 * Members tab's per-row role picker. Never accepts 'owner' as a target --
 * RLS forbids it, and the UI should route that action through Transfer
 * Ownership instead. */
export async function updateProjectMemberRole(projectId, employeeId, role) {
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("employee_id", employeeId);

  if (error) throw error;

  return true;
}
