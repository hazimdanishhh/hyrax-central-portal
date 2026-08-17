import { supabase } from "../../../../../lib/supabaseClient";
import { normalizeFields } from "@/features/_shared/normalizeFields";

/**
 * CREATE -- goes through the create_project(...) RPC, not a plain insert.
 * This is required, not stylistic: a project needs its creator inserted
 * into project_members (role='owner') in the SAME transaction as the
 * projects row itself, or the creator would briefly have a project they
 * can't see under the membership-gated SELECT policy. The RPC also
 * accepts optional initial leads/members/ccs so a caller doesn't have to
 * immediately go edit membership again right after creating.
 *
 * `memberEmployeeIds` always includes the creator's own employee.id --
 * belt-and-suspenders on top of the RPC/trigger's own guarantee, so this
 * feature can't be silently broken by someone unchecking themselves in
 * the picker.
 */
export async function createProject({
  name,
  description,
  startDate,
  targetEndDate,
  categoryId,
  memberEmployeeIds = [],
  leadEmployeeIds = [],
  ccEmployeeIds = [],
}) {
  const { data, error } = await supabase.rpc("create_project", {
    p_name: name,
    p_description: description || null,
    p_start_date: startDate || null,
    p_target_end_date: targetEndDate || null,
    p_category_id: categoryId || null,
    p_member_employee_ids: memberEmployeeIds,
    p_lead_employee_ids: leadEmployeeIds,
    p_cc_employee_ids: ccEmployeeIds,
  });

  if (error) throw error;

  return data; // the new project's id
}

/**
 * UPDATE -- plain column update, RLS restricts this to elevated members
 * (owner/lead). category_id/member arrays are handled separately (a
 * plain-column update can't express junction-table membership changes) --
 * see projectMembersMutations.js's syncProjectMembers.
 */
export async function updateProject(updatedData) {
  const { id, project_members: _members, category: _category, progress_percentage: _progress, ...rawFields } = updatedData;

  const fields = normalizeFields(rawFields);

  const { data, error } = await supabase
    .from("projects")
    .update(fields)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

/**
 * DELETE -- RLS restricts this to the project's owner. guard_project_deletion()
 * additionally blocks it unless the project is already CANCELLED or has no
 * tasks -- surfaced to the caller as the trigger's own raised message via
 * getFriendlyError's default (raw err.message) fallback.
 */
export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) throw error;

  return true;
}

/**
 * Ownership transfer -- the ONLY path allowed to move the 'owner' tag
 * (see transfer_project_ownership.sql). A plain project_members role
 * update can never set/unset 'owner' -- RLS forbids it outright.
 */
export async function transferProjectOwnership({ projectId, newOwnerEmployeeId }) {
  const { error } = await supabase.rpc("transfer_project_ownership", {
    p_project_id: projectId,
    p_new_owner_employee_id: newOwnerEmployeeId,
  });

  if (error) throw error;

  return true;
}
