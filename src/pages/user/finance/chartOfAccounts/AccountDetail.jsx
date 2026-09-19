import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import { fetchGlAccountByCode } from "../../../../features/finance/chartOfAccounts/private/api/accountLedgerService";
import AccountLedger from "./accountLedger/AccountLedger";
import CategoryDetail from "./categoryDetail/CategoryDetail";

/**
 * Route gate for /app/finance/chart-of-accounts/:accountCode -- one URL, one
 * "tell me about this GL account" contract (see AccountLedger.jsx's own
 * header comment), branching on is_postable rather than needing two
 * separate routes. A postable account has its own transaction lines
 * (Account Ledger); a non-postable/title account has no lines of its own,
 * only child accounts and a rolled-up balance (Category Detail).
 *
 * Fetches the same ["gl_account", accountCode] query AccountLedger.jsx
 * fetches internally -- React Query dedupes this, so branching here costs
 * no extra network round trip, and AccountLedger itself stays completely
 * unchanged (it doesn't need to know this gate exists).
 */
export default function AccountDetail() {
  const { accountCode } = useParams();

  const { data: account, isLoading } = useQuery({
    queryKey: ["gl_account", accountCode],
    queryFn: () => fetchGlAccountByCode(accountCode),
    enabled: !!accountCode,
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <CardLayout style="cardLayoutFlexFull">
        <LoadingIcon />
      </CardLayout>
    );
  }

  return account?.is_postable === "Y" ? <AccountLedger /> : <CategoryDetail />;
}
