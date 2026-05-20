import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchClientsMetadata() {
  const [industries] = await Promise.all([
    supabase.from("industries").select("*").order("name"),
  ]);

  return {
    industries: industries.data || [],
  };
}
