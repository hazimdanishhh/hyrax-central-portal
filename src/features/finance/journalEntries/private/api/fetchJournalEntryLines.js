import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only journal entry line items, backed by sap_gl_journal_lines. Joins
 * to sap_gl_accounts for a human-readable account_name -- there's no
 * account_name column denormalized onto the line table itself (mirrors how
 * fetchBillLines joins sap_items for item_name).
 *
 * bp_code -> a resolved name is a SEPARATE lookup, not a nested-select embed
 * (bp_code has no real foreign key to sap_customers -- mirrored SAP table,
 * no DB constraint -- so PostgREST can't embed it). Same "resolve codes,
 * attach client-side" shape as salesOrdersService.js's attachRep.
 *
 * bp_code is NOT always a real business partner (found 2026-09, after the
 * Business Partner drill-through shipped assuming it always was): SAP B1's
 * underlying field (JDT1.ShortName) is a control-account/BP reference that
 * can hold either a genuine CardCode or fall back to a GL account code --
 * this repo has no live-SAP-data query tool to confirm the exact mechanism
 * (see CLAUDE.md's research-discipline section; that verification belongs
 * to the sibling hyrax-data-platform repo), so rather than guess at the
 * rule, this resolves empirically: try sap_customers first, and for
 * whatever's left unmatched, try sap_gl_accounts. `bp_link_type` records
 * which one (if either) actually matched, so the UI can link to the right
 * destination and label it unambiguously (see
 * journalLinesTableConfig.jsx/DASHBOARD-CONVENTIONS.md's own
 * source-labeling convention). A bp_code matching neither falls back to the
 * raw code with no link -- this is a LEFT JOIN in spirit, never drops a
 * line.
 */
export async function fetchJournalEntryLines(transId) {
  if (!transId) return [];

  const { data, error } = await supabase
    .from("sap_gl_journal_lines")
    .select("*, sap_gl_accounts(account_name)")
    .eq("trans_id", transId)
    .order("line_id", { ascending: true });

  if (error) throw error;

  const lines = data || [];

  const bpCodes = [...new Set(lines.map((line) => line.bp_code).filter(Boolean))];
  let namesByCode = {};

  if (bpCodes.length > 0) {
    const { data: customers, error: customersError } = await supabase
      .from("sap_customers")
      .select("customer_code, customer_name")
      .in("customer_code", bpCodes);

    if (customersError) throw customersError;

    namesByCode = Object.fromEntries(
      (customers || []).map((customer) => [
        customer.customer_code,
        customer.customer_name,
      ]),
    );
  }

  // Only the codes that DIDN'T resolve as a business partner -- avoids a
  // redundant lookup for the common case where every bp_code is a genuine
  // customer/vendor.
  const unmatchedCodes = bpCodes.filter((code) => !namesByCode[code]);
  let accountNamesByCode = {};

  if (unmatchedCodes.length > 0) {
    const { data: accounts, error: accountsError } = await supabase
      .from("sap_gl_accounts")
      .select("account_code, account_name")
      .in("account_code", unmatchedCodes);

    if (accountsError) throw accountsError;

    accountNamesByCode = Object.fromEntries(
      (accounts || []).map((account) => [
        account.account_code,
        account.account_name,
      ]),
    );
  }

  return lines.map((line) => {
    if (!line.bp_code) {
      return { ...line, bp_name: null, bp_link_type: null };
    }

    if (namesByCode[line.bp_code]) {
      return {
        ...line,
        bp_name: namesByCode[line.bp_code],
        bp_link_type: "business-partner",
      };
    }

    if (accountNamesByCode[line.bp_code]) {
      return {
        ...line,
        bp_name: accountNamesByCode[line.bp_code],
        bp_link_type: "account",
      };
    }

    return { ...line, bp_name: null, bp_link_type: null };
  });
}
