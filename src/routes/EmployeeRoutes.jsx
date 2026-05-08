import { Navigate, Route } from "react-router";
import Onboarding from "../pages/user/employee/onboarding/Onboarding";
import LeaveRequest from "../pages/user/employee/leaveRequest/LeaveRequest";
import Claims from "../pages/user/employee/claims/Claims";
import MyDocuments from "../pages/user/employee/myDocuments/MyDocuments";
import Policies from "../pages/user/employee/policies/Policies";

export default (
  <Route path="employee">
    {/* INDEX */}
    <Route index element={<Navigate to="onboarding" replace />} />

    <Route path="onboarding" element={<Onboarding />} />
    <Route path="leave-request" element={<LeaveRequest />} />
    <Route path="claims" element={<Claims />} />
    <Route path="documents" element={<MyDocuments />} />
    <Route path="policies" element={<Policies />} />
  </Route>
);
