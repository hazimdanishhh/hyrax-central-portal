import { supabase } from "../../lib/supabaseClient";

export async function deleteAttendancePhoto(path) {
  if (!path) return;

  const { error } = await supabase.storage.from("attendance").remove([path]);

  if (error) throw error;
}
