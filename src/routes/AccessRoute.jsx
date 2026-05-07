// src/routes/AccessRoute.jsx

import { Navigate } from "react-router-dom";
import { useAccessControl } from "../context/AccessControlContext";
import UnauthorizedUser from "../pages/unauthorized/UnauthorizedUser";

export default function AccessRoute({
  children,
  roles = [],
  departments = [],
}) {
  const { canAccess } = useAccessControl();

  const allowed = canAccess({
    roles,
    departments,
  });

  if (!allowed) {
    return <UnauthorizedUser />;
  }

  return children;
}
