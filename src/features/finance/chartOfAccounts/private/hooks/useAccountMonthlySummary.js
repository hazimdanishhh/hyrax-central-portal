import { useQuery } from "@tanstack/react-query";
import { fetchAccountMonthlySummary } from "../api/accountLedgerService";

/**
 * Backs both of the Account Ledger page's charts (Monthly Balance
 * filtered-to-period, Per Annum -- added 2026-09) off ONE always-unbounded
 * fetch, rather than a separate RPC call per chart --
 * get_account_monthly_summary's own null-start/null-end case already means
 * "full history" (same convention as every other RPC in this app), and a
 * single account's month-count is small (a few dozen to ~100 rows even for
 * a years-old account), so there's no cost to always fetching everything
 * and slicing/grouping it client-side in AccountLedger.jsx instead of
 * re-querying per view.
 */
export function useAccountMonthlySummary(accountCode) {
  return useQuery({
    queryKey: ["account_monthly_summary", accountCode],
    queryFn: () => fetchAccountMonthlySummary({ accountCode }),
    enabled: !!accountCode,
    staleTime: 1000 * 60,
  });
}
