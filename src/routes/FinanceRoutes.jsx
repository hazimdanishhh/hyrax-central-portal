import { Navigate, Route } from "react-router";
import AccessRoute from "./AccessRoute";
import Invoices from "../pages/user/finance/invoices/Invoices";
import Payments from "../pages/user/finance/payments/Payments";
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
        <AccessRoute departments={["FIN"]}>
          <FinancialReports />
        </AccessRoute>
      }
    />
  </Route>
);
