import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOrganizationHierarchy } from "../api/fetchOrganizationHierarchy";
import {
  buildOrganizationTree,
  getManagerSubtreeIds,
  getDepartmentHighlightIds,
} from "../../../../../functions/buildOrganizationTree";

// departmentId/managerId are the two independent filters -- see
// buildOrganizationTree.js for why they behave differently (manager prunes
// to a subtree, department only highlights/dims within whatever's shown).
export function useOrganizationHierarchy({ departmentId, managerId } = {}) {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["organization_hierarchy"],
    queryFn: fetchOrganizationHierarchy,
  });

  const activeEmployees = useMemo(
    () => (data || []).filter((e) => e.employment_status?.name === "Active"),
    [data],
  );

  // Manager filter options: only employees who actually appear as someone's
  // manager_id, not every employee.
  const managers = useMemo(() => {
    const managerIds = new Set(
      activeEmployees.map((e) => e.manager_id).filter(Boolean),
    );
    return activeEmployees.filter((e) => managerIds.has(e.id));
  }, [activeEmployees]);

  const departments = useMemo(() => {
    const byId = new Map();
    activeEmployees.forEach((e) => {
      if (e.department) byId.set(e.department.id, e.department);
    });
    return [...byId.values()];
  }, [activeEmployees]);

  const visibleEmployees = useMemo(() => {
    const subtreeIds = getManagerSubtreeIds(activeEmployees, managerId);
    return subtreeIds
      ? activeEmployees.filter((e) => subtreeIds.has(e.id))
      : activeEmployees;
  }, [activeEmployees, managerId]);

  const { nodes: builtNodes, edges } = useMemo(
    () => buildOrganizationTree(visibleEmployees),
    [visibleEmployees],
  );

  const nodes = useMemo(() => {
    const highlightIds = getDepartmentHighlightIds(
      visibleEmployees,
      departmentId,
    );
    if (!highlightIds) return builtNodes;

    return builtNodes.map((node) => ({
      ...node,
      data: { ...node.data, isDimmed: !highlightIds.has(node.id) },
    }));
  }, [builtNodes, visibleEmployees, departmentId]);

  return {
    nodes,
    edges,
    managers,
    departments,
    totalActiveCount: activeEmployees.length,
    visibleCount: visibleEmployees.length,
    isLoading,
    isFetching,
    error,
  };
}
