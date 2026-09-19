import { supabase } from "../../../../../lib/supabaseClient";

// sap_gl_journal_entries (this header list) has no account_code/bp_code
// column of its own -- both only live on sap_gl_journal_lines. Resolves
// which trans_ids touched a given value on the given column. The [-1]
// sentinel keeps a genuine zero-match filter returning zero rows instead of
// leaving `.in()` to an empty array's inconsistent behavior.
async function resolveTransIdsByLineColumn(column, value) {
  const { data, error } = await supabase
    .from("sap_gl_journal_lines")
    .select("trans_id")
    .eq(column, value);

  if (error) throw error;

  const ids = [...new Set((data || []).map((line) => line.trans_id))];
  return ids.length > 0 ? ids : [-1];
}

// Every filter here reads a column that exists on BOTH
// sap_gl_journal_entries (the raw base table) and
// sap_gl_journal_entries_with_flags (the enriched view) -- unlike Sales
// Orders' fulfillmentOrdersService.js, Journal Entries currently has no
// filter that ONLY exists on the enriched view (is_unbalanced/
// has_nonpostable_posting back a display-only row-flag badge today, not a
// filter), so this one function is safe to apply to both the count query
// and the data query below with no enriched/base branching needed. If a
// filter on those two columns is ever added, mirror
// fulfillmentOrdersService.js's own hasEnrichedFilter/applyEnrichedFilters
// split instead of just bolting it on here.
function applyJournalEntryFilters(query, { search, filters, accountTransIds, bpTransIds }) {
  let q = query;

  if (search) {
    q = q.or(`memo.ilike.%${search}%,reference_1.ilike.%${search}%`);
  }

  if (accountTransIds) q = q.in("trans_id", accountTransIds);
  if (bpTransIds) q = q.in("trans_id", bpTransIds);

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === "") return;

    switch (key) {
      case "startDate":
        q = q.gte("posting_date", value);
        break;

      case "endDate":
        q = q.lte("posting_date", value);
        break;

      // Only "-3" (SAP B1's reserved period-end closing entry) is a
      // verified trans_type code in this codebase -- see filterConfig.js's
      // own comment for why other codes aren't mapped/filtered here yet.
      case "entryType":
        if (value === "closingOnly") q = q.eq("trans_type", "-3");
        else if (value === "excludeClosing") q = q.neq("trans_type", "-3");
        break;

      default:
        break; // accountCode/bpCode already resolved into *TransIds above
    }
  });

  return q;
}

/**
 * Read-only General Ledger journal entry list. SAP is the system of record
 * for this data -- no create/update/delete here.
 *
 * COUNT always runs against the raw sap_gl_journal_entries table, never
 * sap_gl_journal_entries_with_flags -- found 2026-09: the view's
 * left-join-lateral aggregate (over sap_gl_journal_lines, confirmed 620K+
 * rows and growing daily per get_finance_dashboard_rpc.sql's own comment)
 * has to run once per row just to produce an exact count, which timed out
 * (real prior 57014 precedent on these exact tables). DATA still reads the
 * enriched view -- cheap, since the lateral join there only ever has to run
 * for the `pageSize` rows `.range()` actually returns, not the whole
 * filtered set. Mirrors fulfillmentOrdersService.js's own count-splitting
 * fix for sap_sales_orders_with_fulfillment, simplified per
 * applyJournalEntryFilters' own comment (no enriched-only filter exists
 * here today).
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

  const [accountTransIds, bpTransIds] = await Promise.all([
    filters?.accountCode
      ? resolveTransIdsByLineColumn("account_code", filters.accountCode)
      : Promise.resolve(null),
    filters?.bpCode
      ? resolveTransIdsByLineColumn("bp_code", filters.bpCode)
      : Promise.resolve(null),
  ]);

  const filterArgs = { search, filters, accountTransIds, bpTransIds };

  const countQuery = applyJournalEntryFilters(
    supabase
      .from("sap_gl_journal_entries")
      .select("trans_id", { count: "exact", head: true }),
    filterArgs,
  );

  const dataQuery = applyJournalEntryFilters(
    supabase.from("sap_gl_journal_entries_with_flags").select("*"),
    filterArgs,
  )
    .order(sortBy, { ascending: sortOrder === "ascending" })
    .range(from, to);

  const [
    { count, error: countError },
    { data, error: dataError },
  ] = await Promise.all([countQuery, dataQuery]);

  if (countError) throw countError;
  if (dataError) throw dataError;

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
    .from("sap_gl_journal_entries_with_flags")
    .select("*")
    .eq("trans_id", Number(transId))
    .maybeSingle();

  if (error) throw error;

  return data || null;
}
