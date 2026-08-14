import { supabase } from "../../../../lib/supabaseClient";

/**
 * Real backing for the Notifications page + Navbar bell dropdown --
 * replaces src/data/notificationData.js's hardcoded mock. RLS already
 * restricts reads to the caller's own rows (or superadmin), but userId is
 * still explicitly filtered here so a superadmin's OWN notifications page
 * shows only their own, not everyone's -- RLS is a safety net, not what
 * decides what a given page means to show.
 */
export async function fetchNotifications({
  userId,
  page,
  pageSize,
  search,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order(sortBy, { ascending: sortOrder === "ascending" });

  if (search) {
    query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  }

  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

export async function fetchUnreadNotificationCount(userId) {
  if (!userId) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read_status", false);

  if (error) throw error;

  return count || 0;
}

export async function fetchRecentNotifications(userId, limit = 4) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data || [];
}

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_status: true })
    .eq("id", id);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_status: true })
    .eq("user_id", userId)
    .eq("read_status", false);

  if (error) throw error;
}
