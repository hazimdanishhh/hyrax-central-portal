import { Navigate, Route } from "react-router";
import ITDashboard from "../pages/user/it/dashboard/ITDashboard";
import ITAssetsPageLayout from "../pages/user/it/ITAssetManagement/ITAssetsPageLayout";
import ITAssetOverview from "../pages/user/it/ITAssetManagement/overview/ITAssetOverview";
import ITAssetManagement from "../pages/user/it/ITAssetManagement/list/ITAssetManagement";
import SoftwareManagement from "../pages/user/it/softwareManagement/SoftwareManagement";
import LifecycleCaseList from "../pages/user/employeeLifecycle/list/LifecycleCaseList";
import LifecycleCaseDetail from "../pages/user/employeeLifecycle/detail/LifecycleCaseDetail";
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

    {/* EMPLOYEE ONBOARDING/OFFBOARDING CHECKLISTS -- same shared
        components HRRoutes.jsx mounts above, see
        docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md. */}
    <Route path="onboarding">
      <Route
        index
        element={
          <AccessRoute departments={["IT"]}>
            <LifecycleCaseList caseType="ONBOARDING" />
          </AccessRoute>
        }
      />
      <Route
        path=":caseId"
        element={
          <AccessRoute departments={["IT"]}>
            <LifecycleCaseDetail />
          </AccessRoute>
        }
      />
    </Route>

    <Route path="offboarding">
      <Route
        index
        element={
          <AccessRoute departments={["IT"]}>
            <LifecycleCaseList caseType="OFFBOARDING" />
          </AccessRoute>
        }
      />
      <Route
        path=":caseId"
        element={
          <AccessRoute departments={["IT"]}>
            <LifecycleCaseDetail />
          </AccessRoute>
        }
      />
    </Route>
  </Route>
);
