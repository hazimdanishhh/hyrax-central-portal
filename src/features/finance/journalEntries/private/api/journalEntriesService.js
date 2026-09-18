import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only General Ledger journal entry list, backed directly by the
 * sap_gl_journal_entries mirror table (OJDT headers). SAP is the system of
 * record for this data -- no create/update/delete here. Unlike
 * Invoices/Bills, there's no customer/vendor or open/closed status dimension
 * on a journal entry, so the only visible filters (SearchFilterBar/Fiscal
 * Year) are date-range only -- accountCode (below) is a second, URL-only
 * filter with no SearchFilterBar control of its own, reached exclusively via
 * Chart of Accounts' own "View Journal Entries" reverse link.
 */
export async function fetchJournalEntries({
  page,
  pageSize,
  search,
  filters,
  sortBy,
  sortOrder,
}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("sap_gl_journal_entries")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortOrder === "ascending" });

  // --- SEARCH ---
  if (search) {
    query = query.or(
      `memo.ilike.%${search}%,reference_1.ilike.%${search}%`,
    );
  }

  // --- ACCOUNT CODE (reverse link from Chart of Accounts) --- sap_gl_
  // journal_entries (this header list) has no account_code column of its
  // own -- account_code only lives on sap_gl_journal_lines. Resolve which
  // trans_ids touched this account first, same "resolve ids, then .in()"
  // shape as invoicesService.js's docEntries/customerCodes filters. The
  // [-1] sentinel keeps a genuine zero-match filter returning zero rows
  // instead of leaving `.in()` to an empty array's inconsistent behavior.
  if (filters?.accountCode) {
    const { data: matchingLines, error: linesError } = await supabase
      .from("sap_gl_journal_lines")
      .select("trans_id")
      .eq("account_code", filters.accountCode);

    if (linesError) throw linesError;

    const matchingTransIds = [
      ...new Set((matchingLines || []).map((line) => line.trans_id)),
    ];
    query = query.in(
      "trans_id",
      matchingTransIds.length > 0 ? matchingTransIds : [-1],
    );
  }

  // --- FILTERS ---
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
        break; // accountCode already resolved above
    }
  });

  // paginate LAST
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

/**
 * Fetch-by-id fallback for the /app/finance/journal-entries/:transId detail
 * route -- covers a direct/shared URL where the journal entry isn't already
 * in the in-memory paginated list. Keyed by trans_id, not doc_entry --
 * sap_gl_journal_entries' natural key (OJDT.TransId), unlike every other
 * Finance submodule here. Mirrors salesOrdersService.js's
 * fetchFulfillmentOrderByDocEntry, minus the rep-enrichment join
 * (fetchJournalEntries doesn't join one either).
 */
export async function fetchJournalEntryByTransId(transId) {
  if (!transId) return null;

  const { data, error } = await supabase
    .from("sap_gl_journal_entries")
    .select("*")
    .eq("trans_id", Number(transId))
    .maybeSingle();

  if (error) throw error;

  return data || null;
}
