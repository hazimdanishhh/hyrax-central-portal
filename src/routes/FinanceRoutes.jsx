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

    {/* INVOICES -- :docEntry child route (2026-08) opens the detail sidebar
        via a real URL, mirroring Sales Orders'/Leads' :docEntry/:leadId
        pattern, so a matched-entity card elsewhere (e.g. a Sales Order's
        "MATCHED INVOICE(S)" block) can deep-link straight to one invoice. */}
    <Route
      path="invoices"
      element={
        <AccessRoute departments={["FIN"]}>
          <Invoices />
        </AccessRoute>
      }
    >
      <Route path=":docEntry" element={null} />
    </Route>

    {/* PAYMENTS -- :docEntry child route (2026-08), same pattern as Invoices. */}
    <Route
      path="payments"
      element={
        <AccessRoute departments={["FIN"]}>
          <Payments />
        </AccessRoute>
      }
    >
      <Route path=":docEntry" element={null} />
    </Route>

    {/* BILLS (Accounts Payable chain, added 2026-07, Finance Expansion Phase 1) --
        access gate mirrors Invoices' exactly (department-only, no role
        restriction), since Bills mirrors Invoices file-for-file. :docEntry
        child route (2026-08), same pattern as Invoices. */}
    <Route
      path="bills"
      element={
        <AccessRoute departments={["FIN"]}>
          <Bills />
        </AccessRoute>
      }
    >
      <Route path=":docEntry" element={null} />
    </Route>

    {/* VENDOR PAYMENTS (Accounts Payable chain, added 2026-07, Finance Expansion Phase 1) --
        access gate mirrors Payments' exactly (department only, no role restriction),
        since Vendor Payments mirrors Payments file-for-file. :docEntry child
        route (2026-08), same pattern as Invoices. */}
    <Route
      path="vendor-payments"
      element={
        <AccessRoute departments={["FIN"]}>
          <VendorPayments />
        </AccessRoute>
      }
    >
      <Route path=":docEntry" element={null} />
    </Route>

    {/* JOURNAL ENTRIES (General Ledger, added 2026-07, Finance Expansion
        Phase 2 follow-up) -- access gate mirrors Bills'/Invoices' exactly
        (department-only, no role restriction), since Journal Entries mirrors
        that same read-only list+drill-down pattern. :transId child route
        (2026-08) -- trans_id, not doc_entry, is sap_gl_journal_entries'
        natural key. */}
    <Route
      path="journal-entries"
      element={
        <AccessRoute departments={["FIN"]}>
          <JournalEntries />
        </AccessRoute>
      }
    >
      <Route path=":transId" element={null} />
    </Route>

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

    {/* CASH FLOW (Finance Expansion Phase 3, added 2026-08) -- KNOWN OPEN
        DISCREPANCY (found 2026-08 audit, left as-is pending a decision):
        this gate is actually departments={["FIN","MGM"]} roles={["manager"]},
        the same as Reports -- NOT the department-only, no-role-restriction
        gate Journal Entries/Chart of Accounts use, despite earlier drafts of
        this comment claiming parity with them. Effect: a non-manager FIN
        staff member can open Bills/Invoices/Journal Entries but is blocked
        here. Flagging rather than changing until someone confirms which
        behavior is actually intended. */}
    <Route
      path="cash-flow"
      element={
        <AccessRoute departments={["FIN", "MGM"]} roles={["manager"]}>
          <CashFlow />
        </AccessRoute>
      }
    />

    {/* BALANCE SHEET (Statement of Financial Position, added 2026-08) --
        same known open gate discrepancy as Cash Flow above (manager-only,
        not department-only) -- see that comment. */}
    <Route
      path="balance-sheet"
      element={
        <AccessRoute departments={["FIN", "MGM"]} roles={["manager"]}>
          <BalanceSheet />
        </AccessRoute>
      }
    />

    {/* INCOME STATEMENT (Finance Expansion Phase 6, added 2026-08) -- same
        known open gate discrepancy as Cash Flow above (manager-only, not
        department-only) -- see that comment. */}
    <Route
      path="income-statement"
      element={
        <AccessRoute departments={["FIN", "MGM"]} roles={["manager"]}>
          <IncomeStatement />
        </AccessRoute>
      }
    />

    {/* CLAIMS MANAGEMENT -- intentional placeholder: page exists and this
        route is live, but neither sideNavLinkData.js nor
        departmentLinkCardData.js has an active nav entry for it yet (both
        have one commented out, ready to enable). Not an oversight -- leave
        commented until the page itself has real content. */}
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
