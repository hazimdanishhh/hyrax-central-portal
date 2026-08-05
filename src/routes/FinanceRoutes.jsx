import { Navigate, Route } from "react-router";
import AccessRoute from "./AccessRoute";
import Invoices from "../pages/user/finance/invoices/Invoices";
import Payments from "../pages/user/finance/payments/Payments";
import Bills from "../pages/user/finance/bills/Bills";
import VendorPayments from "../pages/user/finance/vendorPayments/VendorPayments";
import ClaimsManagement from "../pages/user/finance/claimsManagement/ClaimsManagement";
import FinancialReports from "../pages/user/finance/financialReports/FinancialReports";
import JournalEntries from "../pages/user/finance/journalEntries/JournalEntries";
import ChartOfAccounts from "../pages/user/finance/chartOfAccounts/ChartOfAccounts";
import CashFlow from "../pages/user/finance/cashFlow/CashFlow";
import BalanceSheet from "../pages/user/finance/balanceSheet/BalanceSheet";
import IncomeStatement from "../pages/user/finance/incomeStatement/IncomeStatement";

export default (
  <Route path="finance">
    {/* INDEX */}
    <Route index element={<Navigate to="reports" replace />} />

    {/* INVOICES */}
    <Route
      path="invoices"
      element={
        <AccessRoute departments={["FIN"]}>
          <Invoices />
        </AccessRoute>
      }
    />

    {/* PAYMENTS */}
    <Route
      path="payments"
      element={
        <AccessRoute departments={["FIN"]}>
          <Payments />
        </AccessRoute>
      }
    />

    {/* BILLS (Accounts Payable chain, added 2026-07, Finance Expansion Phase 1) --
        access gate mirrors Invoices' exactly (department-only, no role
        restriction), since Bills mirrors Invoices file-for-file. */}
    <Route
      path="bills"
      element={
        <AccessRoute departments={["FIN"]}>
          <Bills />
        </AccessRoute>
      }
    />

    {/* VENDOR PAYMENTS (Accounts Payable chain, added 2026-07, Finance Expansion Phase 1) --
        access gate mirrors Payments' exactly (department only, no role restriction),
        since Vendor Payments mirrors Payments file-for-file. */}
    <Route
      path="vendor-payments"
      element={
        <AccessRoute departments={["FIN"]}>
          <VendorPayments />
        </AccessRoute>
      }
    />

    {/* JOURNAL ENTRIES (General Ledger, added 2026-07, Finance Expansion
        Phase 2 follow-up) -- access gate mirrors Bills'/Invoices' exactly
        (department-only, no role restriction), since Journal Entries mirrors
        that same read-only list+drill-down pattern. */}
    <Route
      path="journal-entries"
      element={
        <AccessRoute departments={["FIN"]}>
          <JournalEntries />
        </AccessRoute>
      }
    />

    {/* CHART OF ACCOUNTS (General Ledger reference data, added 2026-07,
        Finance Expansion Phase 2 follow-up) -- same access gate as Journal
        Entries, since it pairs directly with it (looking up what an
        account_code on a journal line means). */}
    <Route
      path="chart-of-accounts"
      element={
        <AccessRoute departments={["FIN"]}>
          <ChartOfAccounts />
        </AccessRoute>
      }
    />

    {/* CASH FLOW (Finance Expansion Phase 3, added 2026-08) -- same access
        gate as Journal Entries/Chart of Accounts (department-only, no role
        restriction): a computed statement, not a browsable list, but reuses
        that same read-only Finance reference-page pattern. */}
    <Route
      path="cash-flow"
      element={
        <AccessRoute departments={["FIN", "MGM"]} roles={["manager"]}>
          <CashFlow />
        </AccessRoute>
      }
    />

    {/* BALANCE SHEET (Statement of Financial Position, added 2026-08) --
        same access gate as Cash Flow/Journal Entries/Chart of Accounts
        (department-only, no role restriction): a computed, point-in-time
        statement, not a browsable list. */}
    <Route
      path="balance-sheet"
      element={
        <AccessRoute departments={["FIN", "MGM"]} roles={["manager"]}>
          <BalanceSheet />
        </AccessRoute>
      }
    />

    {/* INCOME STATEMENT (Finance Expansion Phase 6, added 2026-08) -- same
        access gate as Cash Flow/Balance Sheet (department-only, no role
        restriction): a computed, period-bound statement, not a browsable
        list. */}
    <Route
      path="income-statement"
      element={
        <AccessRoute departments={["FIN", "MGM"]} roles={["manager"]}>
          <IncomeStatement />
        </AccessRoute>
      }
    />

    {/* CLAIMS MANAGEMENT */}
    <Route
      path="claims-management"
      element={
        <AccessRoute departments={["FIN"]}>
          <ClaimsManagement />
        </AccessRoute>
      }
    />

    {/* REPORTS */}
    <Route
      path="reports"
      element={
        <AccessRoute departments={["FIN", "MGM"]} roles={["manager"]}>
          <FinancialReports />
        </AccessRoute>
      }
    />
  </Route>
);
