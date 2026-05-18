import { Navigate, Route } from "react-router-dom";
import Clients from "../pages/user/sales/clients/Clients";
import Quotations from "../pages/user/sales/quotations/Quotations";
import Reports from "../pages/user/sales/reports/Reports";
import AccessRoute from "./AccessRoute";
import LeadsManagement from "../pages/user/sales/leads/list/LeadsManagement";
import LeadsPageLayout from "../pages/user/sales/leads/LeadsPageLayout";
import LeadsOverview from "../pages/user/sales/leads/overview/LeadsOverview";

export default (
  <Route path="sales">
    {/* INDEX */}
    <Route index element={<Navigate to="reports" replace />} />

    {/* REPORTS */}
    <Route
      path="reports"
      element={
        <AccessRoute departments={["SAL"]} roles={["manager"]}>
          <Reports />
        </AccessRoute>
      }
    />

    {/* OPPORTUNITIES */}
    <Route
      path="leads"
      element={
        <AccessRoute departments={["SAL"]}>
          <LeadsPageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <AccessRoute departments={["SAL"]}>
            <LeadsOverview />
          </AccessRoute>
        }
      />

      <Route
        path="list"
        element={
          <AccessRoute departments={["SAL"]}>
            <LeadsManagement />
          </AccessRoute>
        }
      />
    </Route>

    {/* CLIENTS */}
    <Route
      path="clients"
      element={
        <AccessRoute departments={["SAL"]} roles={["manager"]}>
          <Clients />
        </AccessRoute>
      }
    />

    {/* QUOTATIONS */}
    <Route
      path="quotations"
      element={
        <AccessRoute departments={["SAL"]} roles={["manager"]}>
          <Quotations />
        </AccessRoute>
      }
    />
  </Route>
);
