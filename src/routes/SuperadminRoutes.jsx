import { Navigate, Route } from "react-router";
import AccessRoute from "./AccessRoute";
import Users from "../pages/user/system/userManagement/list/Users";

export default (
  <Route path="system">
    {/* INDEX */}
    <Route index element={<Navigate to="users" replace />} />

    {/* DASHBOARD */}
    <Route
      path="users"
      element={
        <AccessRoute roles={["superadmin"]}>
          <Users />
        </AccessRoute>
      }
    />
  </Route>
);
