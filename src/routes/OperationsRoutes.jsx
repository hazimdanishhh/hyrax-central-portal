import { Navigate, Route } from "react-router-dom";
import AccessRoute from "./AccessRoute";
import OperationsReports from "../pages/user/operations/reports/OperationsReports";

export default (
  <Route path="operations">
    {/* INDEX */}
    <Route index element={<Navigate to="reports" replace />} />

    {/* REPORTS */}
    <Route
      path="reports"
      element={
        <AccessRoute departments={["OPS"]} roles={["manager"]}>
          <OperationsReports />
        </AccessRoute>
      }
    />
  </Route>
);
