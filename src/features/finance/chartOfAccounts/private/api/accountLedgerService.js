import { supabase } from "../../../../../lib/supabaseClient";
import { resolveBpNames } from "../../../_shared/resolveBpNames";

/**
 * Read-only line-level ledger for a single GL account, backed by
 * sap_gl_journal_lines_with_entry_info (see
 * sap_gl_journal_lines_with_entry_info_view.sql) -- one row per LINE posted
 * to this account, not per whole journal entry. Added 2026-09 to replace
 * Chart of Accounts' previous "jump to Journal Entries filtered by
 * accountCode" behavior, which showed whole multi-account entries (and their
 * entry-wide totals) rather than this account's own activity -- see
 * ChartOfAccounts.jsx's own header comment.
 *
 * accountCode is fixed per page (route param, passed via usePaginatedQuery's
 * extraParams), not a user-editable filter -- only startDate/endDate (from
 * SearchFilterBar's enableDateRange) are real filters here.
 */
export async function fetchAccountLedgerLines({
  page,
  pageSize,
  filters,
  sortBy,
  sortOrder,
  accountCode,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // No account_name embed here -- every row in this ledger is already
  // scoped to the one accountCode the page header displays, so a per-row
  // account name would be redundant. Also avoids relying on PostgREST's FK
  // embed inference through a joined view (untested/unconfirmed here),
  // unlike fetchJournalEntryLines.js's embed against the base table.
  let query = supabase
    .from("sap_gl_journal_lines_with_entry_info")
    .select("*", { count: "exact" })
    .eq("account_code", accountCode);

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "startDate":
        query = query.gte("posting_date", value);
        break;

      case "endDate":
        query = query.lte("posting_date", value);
        break;

      default:
        break;
    }
  });

  query = query
    .order(sortBy, { ascending: sortOrder === "ascending" })
    .range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  const lines = await resolveBpNames(data || []);

  // line_id alone repeats across different entries (it's a per-entry
  // sequence, e.g. 0/1/2) -- this ledger spans every entry that touched the
  // account, so DataTable's rowKey needs the composite natural key instead.
  // Also doubles as this line's parent entry's own JournalEntrySidebar
  // fields (posting_date/memo/reference_1/reference_2/trans_type all came
  // through the view's join), so a clicked row can open that sidebar
  // directly with no extra fetch.
  const linesWithKey = lines.map((line) => ({
    ...line,
    ledger_row_id: `${line.trans_id}_${line.line_id}`,
  }));

  return {
    data: linesWithKey,
    totalCount: count || 0,
  };
}

/**
 * Lightweight single-account lookup for the Account Ledger page header --
 * code/name/drawer, straight off sap_gl_accounts. Not the async-select
 * shape financeMetadataService.js's getSapGlAccountByCode returns
 * ({label, value}) -- this page needs the raw row (drawer, for sign
 * correction) instead.
 */
export async function fetchGlAccountByCode(accountCode) {
  if (!accountCode) return null;

  const { data, error } = await supabase
    .from("sap_gl_accounts")
    .select("account_code, account_name, drawer, is_postable")
    .eq("account_code", accountCode)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

/**
 * Backs the Account Ledger page's monthly trend chart -- see
 * get_account_monthly_summary_rpc.sql's own comment for the full reasoning
 * (reads private.mv_gl_monthly_account_summary server-side, not reachable
 * directly from the frontend).
 */
export async function fetchAccountMonthlySummary({ accountCode, startDate, endDate }) {
  const { data, error } = await supabase.rpc("get_account_monthly_summary", {
    p_account_code: accountCode,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
  });

  if (error) throw error;

  return data || [];
}
