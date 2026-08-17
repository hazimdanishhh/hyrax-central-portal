import { useMemo } from "react";
import { useEmployee } from "../../../../../context/EmployeeContext";
import { useProfile } from "../../../../../context/ProfileContext";

/**
 * Client-side UX gating ONLY -- NOT a security boundary. RLS (see
 * supabase/policies/{projects,tasks,project_members,task_assignees}_crud.sql)
 * is what actually enforces the permission tiers; this hook exists purely
 * so the UI can hide/disable actions the backend would reject anyway,
 * instead of letting someone click "Save" and hit a confusing RLS error.
 *
 * Takes the project's already-fetched member list (via useProject) rather
 * than fetching anything of its own.
 *
 * A superadmin bypasses every RLS policy on projects/project_members/tasks
 * (`using (public.is_superadmin())`), regardless of whether they have a
 * project_members row at all -- this hook previously had no concept of
 * that, so a superadmin managing a project they didn't personally create
 * (no ownership row) saw every elevated action hidden client-side even
 * though the database would have allowed all of them. Folding isSuperAdmin
 * in here fixes that everywhere at once, since this is the one hook every
 * page in this module already calls for its gating.
 */
export function useProjectPermissions(members = []) {
  const { employee } = useEmployee();
  const { isSuperAdmin } = useProfile();

  return useMemo(() => {
    const currentEmployeeId = employee?.id;
    const ownRow = members.find((m) => m.employee_id === currentEmployeeId);
    const role = ownRow?.role ?? null;

    return {
      role,
      isOwner: isSuperAdmin || role === "owner",
      isLead: role === "lead",
      isElevated: isSuperAdmin || role === "owner" || role === "lead",
      isWorkingMember: isSuperAdmin || role === "owner" || role === "lead" || role === "member",
      isCcOnly: !isSuperAdmin && role === "cc",
      isMember: isSuperAdmin || role != null,
    };
  }, [members, employee?.id, isSuperAdmin]);
}
