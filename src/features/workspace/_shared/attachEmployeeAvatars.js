import { supabase } from "../../../lib/supabaseClient";

/**
 * `employees` has no `avatar_url` of its own -- it lives on `profiles`,
 * linked via `employees.profile_id`. Deliberately NOT a nested PostgREST
 * embed (`profile:profiles(avatar_url)`) here -- that would depend on
 * `employees.profile_id` having a real, PostgREST-detectable FK constraint
 * to `public.profiles(id)` specifically (it could just as easily point at
 * `auth.users(id)` instead, which looks identical in the data but isn't
 * embeddable the same way), and this feature already broke once from an
 * unverified assumption about `employees`' own columns. This does two
 * flat queries and merges client-side instead -- the only things it
 * depends on are `profiles.id`/`profiles.avatar_url` and
 * `employees.profile_id` existing as columns, all independently confirmed
 * (`profiles.avatar_url` read directly from `AuthContext.jsx`'s
 * `syncProfile()`; `employees.profile_id` confirmed live via the
 * `pg_attribute` prerequisite query run before this module's deploy).
 *
 * Takes a flat array of employee objects (each needs a `profile_id` field
 * already selected), returns a same-length, same-order array with
 * `avatar_url` attached (`null` if unresolvable) -- callers re-zip this
 * back into whatever parent shape they had (a member row, a task
 * assignee row, etc).
 */
export async function attachEmployeeAvatars(employees) {
  const profileIds = [...new Set(employees.map((e) => e?.profile_id).filter(Boolean))];

  if (!profileIds.length) {
    return employees.map((e) => (e ? { ...e, avatar_url: null } : e));
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .in("id", profileIds);

  if (error) throw error;

  const avatarByProfileId = new Map(profiles.map((p) => [p.id, p.avatar_url]));

  return employees.map((e) => (e ? { ...e, avatar_url: avatarByProfileId.get(e.profile_id) ?? null } : e));
}
