import { useQuery } from "@tanstack/react-query";
import { fetchJournalEntriesOverview } from "../api/journalEntriesService";

const EMPTY_KPIS = {
  totalCount: 0,
  totalDebitMyr: 0,
  totalCreditMyr: 0,
};

/**
 * Backs the Journal Entries list page's "Total" summary -- mirrors the
 * paginated list's active filters/search, same shape as
 * useInvoicesOverview.js, so the total always matches exactly what the
 * table below is showing.
 */
export function useJournalEntriesOverview(filters, search) {
  const query = useQuery({
    queryKey: ["journal_entries", "overview", filters, search],
    queryFn: () => fetchJournalEntriesOverview({ filters, search }),
    staleTime: 1000 * 60,
  });

  return { ...query, kpis: query.data || EMPTY_KPIS };
}
