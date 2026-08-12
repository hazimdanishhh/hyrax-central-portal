import { supabase } from "../../../lib/supabaseClient";

/**
 * Self-service avatar update -- separate from
 * src/features/superadmin/users, which is the admin-side (edit anyone's
 * profile) surface. This one only ever targets your own row.
 */
export async function updateOwnAvatar({ id, avatar_url }) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}
