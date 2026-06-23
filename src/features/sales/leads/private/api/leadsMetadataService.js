import { supabase } from "../../../../../lib/supabaseClient";

export async function fetchLeadsMetadata() {
  const [owners, clients, clientContacts, leadSourceTypes, loseReasons] =
    await Promise.all([
      supabase.from("employees_public").select("*").order("full_name"),
      supabase.from("clients").select("*").order("name"),
      supabase.from("client_contacts").select("*").order("full_name"),
      supabase.from("lead_source_types").select("*").order("name"),
      supabase.from("sales_leads_lose_reasons").select("*").order("name"),
    ]);

  return {
    owners: owners.data || [],
    clients: clients.data || [],
    clientContacts: clientContacts.data || [],
    leadSourceTypes: leadSourceTypes.data || [],
    loseReasons: loseReasons.data || [],
  };
}
