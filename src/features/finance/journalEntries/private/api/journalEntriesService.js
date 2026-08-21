import { supabase } from "../../../../../lib/supabaseClient";

/**
 * Read-only General Ledger journal entry list, backed directly by the
 * sap_gl_journal_entries mirror table (OJDT headers). SAP is the system of
 * record for this data -- no create/update/delete here. Unlike
 * Invoices/Bills, there's no customer/vendor or open/closed status dimension
 * on a journal entry, so filtering here is date-range only.
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
        break;
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
 * fetchSalesOrderByDocEntry, minus the rep-enrichment join
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
