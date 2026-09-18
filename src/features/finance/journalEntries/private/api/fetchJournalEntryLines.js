import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only journal entry line items, backed by sap_gl_journal_lines. Joins
 * to sap_gl_accounts for a human-readable account_name -- there's no
 * account_name column denormalized onto the line table itself (mirrors how
 * fetchBillLines joins sap_items for item_name).
 *
 * bp_code -> a resolved name is a SEPARATE lookup against sap_customers
 * (SAP's own unified Business Partner master -- card_type C/L/S covers
 * customers, leads, and suppliers alike, per sapCustomerSearch.js's own
 * comment), not a nested-select embed: bp_code has no real foreign key to
 * sap_customers (mirrored SAP table, no DB constraint), so PostgREST can't
 * embed it. Same "resolve codes, attach client-side" shape as
 * salesOrdersService.js's attachRep. A bp_code with no match (or none at
 * all) just falls back to the raw code -- this is a LEFT JOIN in spirit,
 * never drops a line.
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

  return lines.map((line) => ({
    ...line,
    bp_name: line.bp_code ? namesByCode[line.bp_code] || null : null,
  }));
}
