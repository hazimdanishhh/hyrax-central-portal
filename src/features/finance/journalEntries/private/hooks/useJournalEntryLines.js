import { useQuery } from "@tanstack/react-query";
import { fetchJournalEntryLines } from "../api/fetchJournalEntryLines";

export function useJournalEntryLines(transId) {
  return useQuery({
    queryKey: ["journal_entry_lines", transId],
    queryFn: () => fetchJournalEntryLines(transId),
    enabled: !!transId,
    staleTime: 1000 * 60 * 5,
  });
}
