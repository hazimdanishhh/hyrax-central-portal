import { supabase } from "../../../lib/supabaseClient";

/**
 * A GL line's bp_code isn't always a real business partner -- SAP B1's
 * underlying field (JDT1.ShortName) can hold either a genuine CardCode or a
 * GL account code instead (found 2026-09, after the Business Partner
 * drill-through shipped assuming it always was -- see
 * fetchJournalEntryLines.js's original comment, and CLAUDE.md's
 * research-discipline section for why this is resolved empirically rather
 * than guessed). Tries sap_customers first, sap_gl_accounts second for
 * whatever's left unmatched -- never drops a line, a code matching neither
 * falls back to the raw code with no link.
 *
 * Extracted 2026-09 (was inline in fetchJournalEntryLines.js only) once the
 * Account Ledger page needed the exact same resolution for its own lines --
 * this is the one place the rule lives now, shared by both.
 */
export async function resolveBpNames(lines) {
  const bpCodes = [...new Set(lines.map((line) => line.bp_code).filter(Boolean))];

  if (bpCodes.length === 0) {
    return lines.map((line) => ({ ...line, bp_name: null, bp_link_type: null }));
  }

  const { data: customers, error: customersError } = await supabase
    .from("sap_customers")
    .select("customer_code, customer_name")
    .in("customer_code", bpCodes);

  if (customersError) throw customersError;

  const namesByCode = Object.fromEntries(
    (customers || []).map((customer) => [
      customer.customer_code,
      customer.customer_name,
    ]),
  );

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
