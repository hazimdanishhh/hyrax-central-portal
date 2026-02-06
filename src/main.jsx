import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles/index.scss";
import "./styles/fonts.scss";
import "./styles/sections.scss";
import LoginPage from "./pages/login/LoginPage";
import Dashboard from "./pages/user/dashboard/Dashboard";
import Error404 from "./pages/error/Error404";
import { AuthProvider } from "./context/AuthContext";
import Profile from "./pages/user/profile/Profile";
import AppLayout from "./layouts/AppLayout";
import ThemeProvider from "./context/ThemeContext";
import Projects from "./pages/user/workspace/projects/Projects";
import Tasks from "./pages/user/workspace/tasks/Tasks";
import Documents from "./pages/user/workspace/documents/Documents";
import Announcements from "./pages/user/announcements/Announcements";
import Notifications from "./pages/user/notifications/Notifications";
import Employees from "./pages/user/hr/employees/Employees";
import LeaveManagement from "./pages/user/hr/leaveManagement/LeaveManagement";
import Recruitment from "./pages/user/hr/recruitment/Recruitment";
import Performance from "./pages/user/hr/performance/Performance";
import Onboarding from "./pages/user/employee/onboarding/Onboarding";
import Attendance from "./pages/user/employee/attendance/Attendance";
import LeaveRequest from "./pages/user/employee/leaveRequest/LeaveRequest";
import MyDocuments from "./pages/user/employee/myDocuments/MyDocuments";
import Policies from "./pages/user/employee/policies/Policies";
import Help from "./pages/user/help/Help";
import Opportunities from "./pages/user/sales/opportunities/Opportunities";
import Reports from "./pages/user/sales/reports/Reports";
import Quotations from "./pages/user/sales/quotations/Quotations";
import Clients from "./pages/user/sales/clients/Clients";
import FinancialReports from "./pages/user/finance/financialReports/FinancialReports";
import Payments from "./pages/user/finance/payments/Payments";
import Invoices from "./pages/user/finance/invoices/Invoices";
import ClaimsManagement from "./pages/user/finance/claimsManagement/ClaimsManagement";
import Claims from "./pages/user/employee/claims/Claims";
import Home from "./pages/index/Home";
import ProtectedRoute from "./context/ProtectedRoute";
import Department from "./pages/user/department/Department";
import EmployeeProfile from "./pages/user/employee/employeeProfile/EmployeeProfile";
import EmployeesList from "./pages/user/employees/Employees";
import IT_Assets from "./pages/user/it/it_assets/IT_Assets";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route index element={<Navigate to="/login" replace />} />

            {/* Authenticated App */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />

              <Route path="announcements" element={<Announcements />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<Profile />} />
              <Route path="department" element={<Department />} />
              <Route path="employees" element={<EmployeesList />} />

              {/* Workspace */}
              <Route path="workspace/projects" element={<Projects />} />
              <Route path="workspace/tasks" element={<Tasks />} />
              <Route path="workspace/documents" element={<Documents />} />

              {/* Sales */}
              <Route path="sales/opportunities" element={<Opportunities />} />
              <Route path="sales/clients" element={<Clients />} />
              <Route path="sales/quotations" element={<Quotations />} />
              <Route path="sales/reports" element={<Reports />} />

              {/* HR */}
              <Route path="hr/employees" element={<Employees />} />
              <Route path="hr/leaves" element={<LeaveManagement />} />
              <Route path="hr/recruitment" element={<Recruitment />} />
              <Route path="hr/performance" element={<Performance />} />

              {/* Finance */}
              <Route path="finance/invoices" element={<Invoices />} />
              <Route path="finance/payments" element={<Payments />} />
              <Route
                path="finance/claims-management"
                element={<ClaimsManagement />}
              />
              <Route path="finance/reports" element={<FinancialReports />} />

              {/* Employee */}
              <Route path="employee/onboarding" element={<Onboarding />} />
              <Route
                path="/app/employee/:employeeId"
                element={<EmployeeProfile />}
              />
              <Route path="employee/attendance" element={<Attendance />} />
              <Route path="employee/leave-request" element={<LeaveRequest />} />
              <Route path="employee/claims" element={<Claims />} />
              <Route path="employee/documents" element={<MyDocuments />} />
              <Route path="employee/policies" element={<Policies />} />

              {/* Information Technology */}
              <Route path="it/assets" element={<IT_Assets />} />

              {/* Help */}
              <Route path="help" element={<Help />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Error404 />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);
