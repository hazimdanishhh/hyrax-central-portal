import { Route } from "react-router";
import Announcements from "../pages/user/announcements/Announcements";
import Dashboard from "../pages/user/dashboard/Dashboard";
import Department from "../pages/user/department/Department";
import EmployeeProfile from "../pages/user/employees/employeeProfile/EmployeeProfile";
import EmployeesPublicPage from "../pages/user/employees/EmployeesPublicPage";
import Notifications from "../pages/user/notifications/Notifications";
import Profile from "../pages/user/profile/Profile";

export default (
  <>
    <Route index element={<Dashboard />} />
    <Route path="announcements" element={<Announcements />} />
    <Route path="notifications" element={<Notifications />} />
    <Route path="profile" element={<Profile />} />
    <Route path="department" element={<Department />} />
    <Route path="employees" element={<EmployeesPublicPage />} />
    <Route path="employees/:employeeId" element={<EmployeeProfile />} />
  </>
);
