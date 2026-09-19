import { Navigate, Route } from "react-router";
import AccessRoute from "./AccessRoute";
import InvoicesPageLayout from "../pages/user/finance/invoices/InvoicesPageLayout";
import Invoices from "../pages/user/finance/invoices/Invoices";
import Payments from "../pages/user/finance/payments/Payments";
import BillsPageLayout from "../pages/user/finance/bills/BillsPageLayout";
import Bills from "../pages/user/finance/bills/Bills";
import VendorPayments from "../pages/user/finance/vendorPayments/VendorPayments";
import ClaimsManagement from "../pages/user/finance/claimsManagement/ClaimsManagement";
import FinancialReports from "../pages/user/finance/financialReports/FinancialReports";
import JournalEntries from "../pages/user/finance/journalEntries/JournalEntries";
import ChartOfAccounts from "../pages/user/finance/chartOfAccounts/ChartOfAccounts";
import AccountLedger from "../pages/user/finance/chartOfAccounts/accountLedger/AccountLedger";
import BusinessPartners from "../pages/user/finance/businessPartners/BusinessPartners";
import CashFlow from "../pages/user/finance/cashFlow/CashFlow";
import BalanceSheet from "../pages/user/finance/balanceSheet/BalanceSheet";
import IncomeStatement from "../pages/user/finance/incomeStatement/IncomeStatement";

export default (
  <Route path="finance">
    {/* INDEX */}
    <Route index element={<Navigate to="reports" replace />} />

    {/* INVOICES & A/R -- merged 2026-09 (standardization pass, Finance
        Phase 1): Invoices and Payments are grouped under one page-tab
        layout ("list"/"payments", matching this app's dominant tab-naming
        convention -- Sales Orders' "all" is a one-off, not the pattern to
        copy). :docEntry child routes on each tab open the detail sidebar
        via a real URL, mirroring Sales Orders'/Leads' :docEntry/:leadId
        pattern, so a matched-entity card elsewhere (e.g. a Sales Order's
        "MATCHED INVOICE(S)"/"MATCHED PAYMENT(S)" blocks, or Sales Reports'
        drill-through tiles) can deep-link straight to one record --
        see docs/DASHBOARD-ROADMAP.md's Finance section for the full list of
        external call sites updated alongside this merge.
        MGM added company-wide (no role restriction) alongside FIN --
        reverses 2026-07's "Judgment call #4" the same way Sales' analogous
        2026-07 restriction was reversed in 2026-09 (see
        supabase/access-control/README.md): Finance/Sales Reports' own
        drill-through KPI tiles/charts, and Sales Order sidebars' matched-
        invoice/matched-payment cards, need MGM to actually open these
        pages, not just see a disabled link. Requires
        supabase/policies/mgm_finance_access_parity_fix.sql deployed too --
        the route guard alone doesn't widen the underlying RLS. */}
    <Route
      path="invoices"
      element={
        <AccessRoute departments={["FIN", "MGM"]}>
          <InvoicesPageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="list" replace />} />
      <Route
        path="list"
        element={
          <AccessRoute departments={["FIN", "MGM"]}>
            <Invoices />
          </AccessRoute>
        }
      >
        <Route path=":docEntry" element={null} />
      </Route>
      <Route
        path="payments"
        element={
          <AccessRoute departments={["FIN", "MGM"]}>
            <Payments />
          </AccessRoute>
        }
      >
        <Route path=":docEntry" element={null} />
      </Route>
    </Route>

    {/* BILLS & A/P (Accounts Payable chain, added 2026-07, Finance Expansion
        Phase 1; merged into one page-tab layout 2026-09 alongside Invoices &
        A/R above, same "list"/"vendor-payments" tab shape) -- access gate
        mirrors Invoices' exactly (department-only, no role restriction),
        since Bills mirrors Invoices file-for-file. :docEntry child routes,
        same pattern as Invoices & A/R. MGM parity -- see Invoices' own
        comment above. Unlike Invoices/Payments, Bills/Vendor Payments had
        zero external deep-link consumers at merge time (confirmed via
        repo-wide grep) -- this half of the merge carried no migration risk. */}
    <Route
      path="bills"
      element={
        <AccessRoute departments={["FIN", "MGM"]}>
          <BillsPageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="list" replace />} />
      <Route
        path="list"
        element={
          <AccessRoute departments={["FIN", "MGM"]}>
            <Bills />
          </AccessRoute>
        }
      >
        <Route path=":docEntry" element={null} />
      </Route>
      <Route
        path="vendor-payments"
        element={
          <AccessRoute departments={["FIN", "MGM"]}>
            <VendorPayments />
          </AccessRoute>
        }
      >
        <Route path=":docEntry" element={null} />
      </Route>
    </Route>

    {/* JOURNAL ENTRIES (General Ledger, added 2026-07, Finance Expansion
        Phase 2 follow-up) -- access gate mirrors Bills'/Invoices' exactly
        (department-only, no role restriction), since Journal Entries mirrors
        that same read-only list+drill-down pattern. :transId child route
        (2026-08) -- trans_id, not doc_entry, is sap_gl_journal_entries'
        natural key. MGM parity -- see Invoices' own comment above. */}
    <Route
      path="journal-entries"
      element={
        <AccessRoute departments={["FIN", "MGM"]}>
          <JournalEntries />
        </AccessRoute>
      }
    >
      <Route path=":transId" element={null} />
    </Route>

    {/* CHART OF ACCOUNTS (General Ledger reference data, added 2026-07,
        Finance Expansion Phase 2 follow-up) -- same access gate as Journal
        Entries, since it pairs directly with it (looking up what an
        account_code on a journal line means). MGM parity -- see Invoices'
        own comment above. */}
    <Route
      path="chart-of-accounts"
      element={
        <AccessRoute departments={["FIN", "MGM"]}>
          <ChartOfAccounts />
        </AccessRoute>
      }
    />

    {/* ACCOUNT LEDGER (added 2026-09) -- a single account's own GL lines,
        opened from Chart of Accounts' row click (replacing its previous
        jump straight into Journal Entries filtered by accountCode -- see
        ChartOfAccounts.jsx's own header comment for why) and from Financial
        Reports' Operating Expense Breakdown bars. Same access gate as Chart
        of Accounts itself -- deliberately NOT get_finance_dashboard's
        stricter FIN/MGM-manager-only gate (see
        get_account_monthly_summary_rpc.sql's own comment), since this is
        reachable from Chart of Accounts' own looser gate. :transId child
        route opens the existing JournalEntrySidebar for a clicked line's
        full parent entry -- same pattern as Journal Entries' own :transId
        route. */}
    <Route
      path="chart-of-accounts/:accountCode"
      element={
        <AccessRoute departments={["FIN", "MGM"]}>
          <AccountLedger />
        </AccessRoute>
      }
    >
      <Route path=":transId" element={null} />
    </Route>

    {/* BUSINESS PARTNERS (unified sap_customers lookup, added 2026-09
        alongside the Finance standardization pass) -- same access gate as
        Journal Entries/Chart of Accounts. Finance's own view of the
        Business Partner master, defaulting to Customer+Vendor (not
        Customer+Lead like Sales' SAP Clients) -- see
        businessPartnersService.js's own comment. This is also
        SAPCustomerCard.jsx's/SAPVendorCard.jsx's link destination for any
        viewer who can't reach Sales' SAP Clients page instead. :customerCode
        child route opens the detail sidebar via a real URL, same pattern as
        SAP Clients'/Invoices'/Bills' own :code/:docEntry routes. */}
    <Route
      path="business-partners"
      element={
        <AccessRoute departments={["FIN", "MGM"]}>
          <BusinessPartners />
        </AccessRoute>
      }
    >
      <Route path=":customerCode" element={null} />
    </Route>

    {/* CASH FLOW (Finance Expansion Phase 3, added 2026-08) -- KNOWN OPEN
        DISCREPANCY (found 2026-08 audit, left as-is pending a decision):
        this gate is actually departments={["FIN","MGM"]} roles={["manager"]},
        the same as Reports -- NOT the department-only, no-role-restriction
        gate Invoices/Bills/Payments/Vendor Payments/Journal Entries/Chart of
        Accounts use. Effect: a non-manager FIN staff member can open those
        six pages but is blocked here. Deliberately NOT touched by the
        2026-09 MGM-parity change on those six pages (see Invoices' own
        comment) -- this is a separate, still-open discrepancy affecting FIN
        itself, not an MGM gap. Flagging rather than changing until someone
        confirms which behavior is actually intended. */}
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
        commented until the page itself has real content. MGM added to the
        route guard for consistency with Finance's other Tier-1 pages (see
        Invoices' own comment) even though it's unreachable via nav today --
        so it doesn't become a forgotten gap once the page goes live. */}
    <Route
      path="claims-management"
      element={
        <AccessRoute departments={["FIN", "MGM"]}>
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
