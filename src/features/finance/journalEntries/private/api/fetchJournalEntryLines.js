import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only journal entry line items, backed by sap_gl_journal_lines. Joins
 * to sap_gl_accounts for a human-readable account_name -- there's no
 * account_name column denormalized onto the line table itself (mirrors how
 * fetchBillLines joins sap_items for item_name).
 */
export async function fetchJournalEntryLines(transId) {
  if (!transId) return [];

  const { data, error } = await supabase
    .from("sap_gl_journal_lines")
    .select("*, sap_gl_accounts(account_name)")
    .eq("trans_id", transId)
    .order("line_id", { ascending: true });

  if (error) throw error;

  return data || [];
}
