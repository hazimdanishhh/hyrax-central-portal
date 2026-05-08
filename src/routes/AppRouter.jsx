// src/routes/AppRouter.jsx

import { BrowserRouter, Routes, Route } from "react-router-dom";

import PublicRoutes from "./PublicRoutes";
import SalesRoutes from "./SalesRoutes";
import HRRoutes from "./HRRoutes";
import GeneralRoutes from "./GeneralRoutes";
import FinanceRoutes from "./FinanceRoutes";
import EmployeeRoutes from "./EmployeeRoutes";
import ITRoutes from "./ITRoutes";
import HelpRoutes from "./HelpRoutes";
import Error404 from "../pages/error/Error404";
import ProtectedRoute from "./ProtectedRoute";
import AppLayout from "../layouts/AppLayout";
import WorkspaceRoutes from "./WorkspaceRoutes";
import SuperadminRoutes from "./SuperadminRoutes";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {PublicRoutes}

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {GeneralRoutes}
          {WorkspaceRoutes}
          {SalesRoutes}
          {HRRoutes}
          {FinanceRoutes}
          {EmployeeRoutes}
          {ITRoutes}
          {HelpRoutes}
          {SuperadminRoutes}

          <Route path="*" element={<Error404 />} />
        </Route>

        <Route path="*" element={<Error404 />} />
      </Routes>
    </BrowserRouter>
  );
}
