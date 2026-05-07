import { Navigate, Route } from "react-router-dom";
import Opportunities from "../pages/user/sales/opportunities/Opportunities";
import Clients from "../pages/user/sales/clients/Clients";
import Quotations from "../pages/user/sales/quotations/Quotations";
import Reports from "../pages/user/sales/reports/Reports";
import AccessRoute from "./AccessRoute";

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
      path="opportunities"
      element={
        <AccessRoute departments={["SAL"]} roles={["manager"]}>
          <Opportunities />
        </AccessRoute>
      }
    />

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
