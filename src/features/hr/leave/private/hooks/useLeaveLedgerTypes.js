import { useQuery } from "@tanstack/react-query";
import { fetchLeaveLedgerTypes } from "../api/leaveRecordsService";

export default function useLeaveLedgerTypes() {
  const { data, isLoading } = useQuery({
    queryKey: ["leave_ledger_types"],
    queryFn: fetchLeaveLedgerTypes,
    staleTime: 1000 * 60 * 5,
  });

  return {
    leaveTypes: data || [],
    isLoading,
  };
}
