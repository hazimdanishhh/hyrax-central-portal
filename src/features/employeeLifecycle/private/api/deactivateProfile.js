import { supabase } from "../../../../lib/supabaseClient";

/**
 * Calls the deactivate_profile() RPC -- see supabase/functions/deactivate_profile.sql.
 * This was previously dead code: the RPC and its sync trigger
 * (sync_lifecycle_item_on_profile_deactivated.sql, which flips the
 * offboarding checklist's `portal_account_deactivated` item to DONE) both
 * already existed and worked, but nothing in the frontend ever called this
 * RPC -- see docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md's
 * confirmed audit finding. That item is `class: "DERIVED"` (never a manual
 * checkbox), so this is the only way it can ever be completed.
 */
export async function deactivateProfile(profileId) {
  const { error } = await supabase.rpc("deactivate_profile", {
    p_profile_id: profileId,
  });

  if (error) throw error;
}
