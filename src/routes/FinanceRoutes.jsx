import { Navigate, Route } from "react-router";
import AccessRoute from "./AccessRoute";
import Invoices from "../pages/user/finance/invoices/Invoices";
import Payments from "../pages/user/finance/payments/Payments";
import Bills from "../pages/user/finance/bills/Bills";
import VendorPayments from "../pages/user/finance/vendorPayments/VendorPayments";
import ClaimsManagement from "../pages/user/finance/claimsManagement/ClaimsManagement";
import FinancialReports from "../pages/user/finance/financialReports/FinancialReports";

export default (
  <Route path="finance">
    {/* INDEX */}
    <Route index element={<Navigate to="reports" replace />} />

    {/* INVOICES */}
    <Route
      path="invoices"
      element={
        <AccessRoute departments={["FIN"]} roles={["manager"]}>
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
        access gate mirrors Invoices' exactly (departments+role), since Bills
        mirrors Invoices file-for-file. */}
    <Route
      path="bills"
      element={
        <AccessRoute departments={["FIN"]} roles={["manager"]}>
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
        <AccessRoute departments={["FIN", "SAL"]} roles={["manager"]}>
          <FinancialReports />
        </AccessRoute>
      }
    />
  </Route>
);
