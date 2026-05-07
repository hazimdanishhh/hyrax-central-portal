import { Navigate, Route } from "react-router";
import ITDashboard from "../pages/user/it/dashboard/ITDashboard";
import ITAssetsPageLayout from "../pages/user/it/ITAssetManagement/ITAssetsPageLayout";
import ITAssetOverview from "../pages/user/it/ITAssetManagement/overview/ITAssetOverview";
import ITAssetManagement from "../pages/user/it/ITAssetManagement/ITAssetManagement";
import SoftwareManagement from "../pages/user/it/softwareManagement/SoftwareManagement";
import AccessRoute from "./AccessRoute";

export default (
  <Route path="it">
    {/* INDEX */}
    <Route index element={<Navigate to="assets" replace />} />

    {/* DASHBOARD */}
    <Route
      path="dashboard"
      element={
        <AccessRoute departments={["IT"]}>
          <ITDashboard />
        </AccessRoute>
      }
    />

    {/* ASSETS */}
    <Route
      path="assets"
      element={
        <AccessRoute departments={["IT"]}>
          <ITAssetsPageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <AccessRoute departments={["IT"]}>
            <ITAssetOverview />
          </AccessRoute>
        }
      />
      <Route
        path="list"
        element={
          <AccessRoute departments={["IT"]}>
            <ITAssetManagement />
          </AccessRoute>
        }
      />
    </Route>

    {/* SOFTWARE */}
    <Route
      path="software"
      element={
        <AccessRoute departments={["IT"]}>
          <SoftwareManagement />
        </AccessRoute>
      }
    />
  </Route>
);
