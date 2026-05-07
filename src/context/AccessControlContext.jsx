// src/context/AccessControlContext.jsx

import { createContext, useContext, useMemo } from "react";
import { useProfile } from "./ProfileContext";
import { sideNavLinkData } from "../data/sideNavLinkData";

// ACCESS CONTROL CONTEXT
// WHAT CAN THE USER ACCESS
const AccessControlContext = createContext();

export function AccessControlProvider({ children }) {
  const { profile, loading, role, isSuperAdmin, isManager, isStaff } =
    useProfile();

  // =========================
  // USER INFO
  // =========================
  const departmentSub = profile?.department?.sub || "GEN";

  // =========================
  // ACCESS CHECKERS
  // =========================
  function hasRole(allowedRoles = []) {
    if (!allowedRoles.length) return true;

    return allowedRoles.includes(role);
  }

  function hasDepartment(allowedDepartments = []) {
    if (!allowedDepartments.length) return true;

    return allowedDepartments.includes(departmentSub);
  }

  // Main RBAC checker
  function canAccess({ roles = [], departments = [] } = {}) {
    // Superadmin bypass
    if (isSuperAdmin) return true;

    const roleAllowed = hasRole(roles);
    const departmentAllowed = hasDepartment(departments);

    return roleAllowed && departmentAllowed;
  }

  // =========================
  // FILTER NAVIGATION
  // =========================

  const navigation = useMemo(() => {
    const allSegments = sideNavLinkData;

    return allSegments
      .map((segment) => {
        const filteredLinks = segment.links.filter((link) =>
          canAccess({
            roles: link.roles,
            departments: link.departments,
          }),
        );

        return {
          ...segment,
          links: filteredLinks,
        };
      })
      .filter((segment) => segment.links.length > 0);
  }, [role, departmentSub]);

  return (
    <AccessControlContext.Provider
      value={{
        role,
        departmentSub,
        loading,

        isSuperAdmin,
        isManager,
        isStaff,

        hasRole,
        hasDepartment,
        canAccess,

        navigation,
      }}
    >
      {children}
    </AccessControlContext.Provider>
  );
}

export function useAccessControl() {
  const context = useContext(AccessControlContext);

  if (!context) {
    throw new Error(
      "useAccessControl must be used inside AccessControlProvider",
    );
  }

  return context;
}
