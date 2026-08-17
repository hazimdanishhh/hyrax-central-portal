import { Navigate, Route } from "react-router";
import AccessRoute from "./AccessRoute";
import Users from "../pages/user/system/userManagement/list/Users";
import PipelineStatus from "../pages/user/system/pipelineStatus/PipelineStatus";

export default (
  <Route path="system">
    {/* INDEX */}
    <Route index element={<Navigate to="users" replace />} />

    {/* USER MANAGEMENT -- single page: KPI overview cards at the top,
        list/search/sidebar below (no separate Overview/List tabs). */}
    <Route
      path="users"
      element={
        <AccessRoute roles={["superadmin"]}>
          <Users />
        </AccessRoute>
      }
    />

    {/* PIPELINE STATUS -- read-only visibility into hyrax-data-platform's
        SAP/Vigilance extractors (sap_pipeline_state + pipeline_run_log) */}
    <Route
      path="pipeline-status"
      element={
        <AccessRoute roles={["superadmin"]}>
          <PipelineStatus />
        </AccessRoute>
      }
    />
  </Route>
);
