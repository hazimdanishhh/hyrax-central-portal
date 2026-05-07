import { Navigate, Route } from "react-router";
import LoginPage from "../pages/login/LoginPage";

export default (
  <>
    <Route path="/login" element={<LoginPage />} />
    <Route index element={<Navigate to="/login" replace />} />
  </>
);
