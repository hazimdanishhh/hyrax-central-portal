import { supabase } from "../../../../../lib/supabaseClient";
import { resolveBpNames } from "../../../_shared/resolveBpNames";

/**
 * Read-only journal entry line items, backed by sap_gl_journal_lines. Joins
 * to sap_gl_accounts for a human-readable account_name -- there's no
 * account_name column denormalized onto the line table itself (mirrors how
 * fetchBillLines joins sap_items for item_name).
 *
 * bp_code -> a resolved name is a SEPARATE lookup, not a nested-select embed
 * (bp_code has no real foreign key to sap_customers -- mirrored SAP table,
 * no DB constraint -- so PostgREST can't embed it). Same "resolve codes,
 * attach client-side" shape as salesOrdersService.js's attachRep. Resolution
 * rule itself lives in resolveBpNames.js (shared with accountLedgerService.js,
 * which needed the exact same bp_code -> name/link logic) -- see that file's
 * own comment for why a bp_code isn't always a real business partner.
 */
export async function fetchJournalEntryLines(transId) {
  if (!transId) return [];

  const { data, error } = await supabase
    .from("sap_gl_journal_lines")
    .select("*, sap_gl_accounts(account_name)")
    .eq("trans_id", transId)
    .order("line_id", { ascending: true });

  if (error) throw error;

  return resolveBpNames(data || []);
}
