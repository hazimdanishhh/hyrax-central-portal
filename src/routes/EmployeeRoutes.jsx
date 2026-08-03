import { Navigate, Route } from "react-router";
import Onboarding from "../pages/user/employee/onboarding/Onboarding";
import LeaveRequest from "../pages/user/employee/leaveRequest/LeaveRequest";
import Claims from "../pages/user/employee/claims/Claims";
import MyDocuments from "../pages/user/employee/myDocuments/MyDocuments";
import Policies from "../pages/user/employee/policies/Policies";
import AttendancePageLayout from "../pages/user/employee/attendance/AttendancePageLayout";
import MyAttendanceOverview from "../pages/user/employee/attendance/overview/MyAttendanceOverview";
import MyAttendance from "../pages/user/employee/attendance/list/MyAttendance";
import TeamAttendancePageLayout from "../pages/user/employee/teamAttendance/TeamAttendancePageLayout";
import TeamAttendanceOverview from "../pages/user/employee/teamAttendance/overview/TeamAttendanceOverview";
import TeamAttendance from "../pages/user/employee/teamAttendance/list/TeamAttendance";
import AccessRoute from "./AccessRoute";

export default (
  <Route path="employee">
    {/* INDEX */}
    <Route index element={<Navigate to="onboarding" replace />} />

    <Route path="onboarding" element={<Onboarding />} />

    {/* MY ATTENDANCE -- R2 universal self-service, no gate */}
    <Route path="attendance" element={<AttendancePageLayout />}>
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<MyAttendanceOverview />} />
      <Route path="list" element={<MyAttendance />} />
    </Route>

    <Route path="leave-request" element={<LeaveRequest />} />
    <Route path="claims" element={<Claims />} />
    <Route path="documents" element={<MyDocuments />} />
    <Route path="policies" element={<Policies />} />

    {/* TEAM ATTENDANCE -- manager-only, no department restriction (any
        manager in any department reviews their own direct reports) */}
    <Route
      path="team-attendance"
      element={
        <AccessRoute roles={["manager"]}>
          <TeamAttendancePageLayout />
        </AccessRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route
        path="overview"
        element={
          <AccessRoute roles={["manager"]}>
            <TeamAttendanceOverview />
          </AccessRoute>
        }
      />
      <Route
        path="list"
        element={
          <AccessRoute roles={["manager"]}>
            <TeamAttendance />
          </AccessRoute>
        }
      />
    </Route>
  </Route>
);
