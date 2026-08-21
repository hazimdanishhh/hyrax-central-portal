import { useQuery } from "@tanstack/react-query";
import { fetchJournalEntryByTransId } from "../api/journalEntriesService";

// Fetch-by-id fallback for the /app/finance/journal-entries/:transId detail
// route -- covers a direct/shared URL where the journal entry isn't already
// in the in-memory paginated list. Keyed by trans_id, not doc_entry. Mirrors
// useSalesOrder.js's role for Orders.jsx exactly.
export function useJournalEntry(transId) {
  return useQuery({
    queryKey: ["journal_entry", transId],
    queryFn: () => fetchJournalEntryByTransId(transId),
    enabled: !!transId,
    staleTime: 1000 * 60 * 5,
  });
}
