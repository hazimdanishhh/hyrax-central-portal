import { Navigate, Route } from "react-router";
import EmployeePageLayout from "../pages/user/hr/employeeManagement/EmployeePageLayout";
import EmployeeOverview from "../pages/user/hr/employeeManagement/overview/EmployeeOverview";
import EmployeeManagement from "../pages/user/hr/employeeManagement/list/EmployeeManagement";
import Departments from "../pages/user/hr/departments/Departments";
import OrganizationChart from "../pages/user/hr/organizationChart/OrganizationChart";
import LeaveManagement from "../pages/user/hr/leaveManagement/LeaveManagement";
import Recruitment from "../pages/user/hr/recruitment/Recruitment";
import AttendancePageLayout from "../pages/user/hr/attendanceManagement/AttendancePageLayout";
import Performance from "../pages/user/hr/performance/Performance";
import AttendanceOverview from "../pages/user/hr/attendanceManagement/overview/AttendanceOverview";
import AttendanceManagement from "../pages/user/hr/attendanceManagement/list/AttendanceManagement";
import LifecycleCaseList from "../pages/user/employeeLifecycle/list/LifecycleCaseList";
import LifecycleCaseDetail from "../pages/user/employeeLifecycle/detail/LifecycleCaseDetail";
import AccessRoute from "./AccessRoute";

export default (
  <Route path="hr">
    {/* INDEX */}
    <Route index element={<Navigate to="employees" replace />} />

    {/* EMPLOYEE MANAGEMENT */}
    <Route
      path="employees"
      element={
        <AccessRoute departments={["HR"]}>
          <EmployeePageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <AccessRoute departments={["HR"]}>
            <EmployeeOverview />
          </AccessRoute>
        }
      />
      <Route
        path="list"
        element={
          <AccessRoute departments={["HR"]}>
            <EmployeeManagement />
          </AccessRoute>
        }
      >
        <Route path=":employeeId" element={null} />
      </Route>
    </Route>

    {/* ATTENDANCE MANAGEMENT */}
    <Route
      path="attendance"
      element={
        <AccessRoute departments={["HR"]}>
          <AttendancePageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <AccessRoute departments={["HR"]}>
            <AttendanceOverview />
          </AccessRoute>
        }
      />

      <Route path="list">
        <Route
          index
          element={
            <AccessRoute departments={["HR"]}>
              <AttendanceManagement />
            </AccessRoute>
          }
        />
        <Route path=":attendanceId" element={<AttendanceManagement />} />
      </Route>
    </Route>

    {/* DEPARTMENT MANAGEMENT */}
    <Route
      path="departments"
      element={
        <AccessRoute departments={["HR"]}>
          <Departments />
        </AccessRoute>
      }
    />

    {/* ORGANIZATION CHART -- maps every active employee to their manager via
        employees.manager_id (self-referencing FK). Deliberately a separate
        route from "departments" above, which is about department *entity*
        management (CRUD on the departments table), not the people
        hierarchy. */}
    <Route
      path="organization-chart"
      element={
        <AccessRoute departments={["HR"]}>
          <OrganizationChart />
        </AccessRoute>
      }
    />

    {/* LEAVE MANAGEMENT */}
    <Route
      path="leaves"
      element={
        <AccessRoute departments={["HR"]}>
          <LeaveManagement />
        </AccessRoute>
      }
    />

    {/* RECRUITMENT MANAGEMENT */}
    <Route
      path="recruitment"
      element={
        <AccessRoute departments={["HR"]}>
          <Recruitment />
        </AccessRoute>
      }
    />

    {/* PERFORMANCE MANAGEMENT */}
    <Route
      path="performance"
      element={
        <AccessRoute departments={["HR"]}>
          <Performance />
        </AccessRoute>
      }
    />

    {/* EMPLOYEE ONBOARDING/OFFBOARDING CHECKLISTS -- see
        docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md. Same
        LifecycleCaseList/LifecycleCaseDetail components ITRoutes.jsx
        mounts below -- one unified case, filtered per viewer via
        useAccessControl() inside the shared detail component, not two
        separately-modeled checklists. */}
    <Route path="onboarding">
      <Route
        index
        element={
          <AccessRoute departments={["HR"]}>
            <LifecycleCaseList caseType="ONBOARDING" />
          </AccessRoute>
        }
      />
      <Route
        path=":caseId"
        element={
          <AccessRoute departments={["HR"]}>
            <LifecycleCaseDetail />
          </AccessRoute>
        }
      />
    </Route>

    <Route path="offboarding">
      <Route
        index
        element={
          <AccessRoute departments={["HR"]}>
            <LifecycleCaseList caseType="OFFBOARDING" />
          </AccessRoute>
        }
      />
      <Route
        path=":caseId"
        element={
          <AccessRoute departments={["HR"]}>
            <LifecycleCaseDetail />
          </AccessRoute>
        }
      />
    </Route>
  </Route>
);
