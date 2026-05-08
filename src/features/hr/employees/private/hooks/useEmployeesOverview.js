import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { groupCount } from "../../../../../functions/dataTransform";
import { fetchEmployeesOverview } from "../api/employeesOverview";

// ======================
// CONFIG
// ======================
const ACTIVE_STATUSES = new Set([
  "Active",
  "Probation",
  "On Leave",
  "Sabbatical",
]);

const TERMINATED_STATUSES = new Set([
  "Terminated",
  "Resigned",
  "Retired",
  "Terminated Notice",
  "Inactive",
  "Suspended",
]);

const INACTIVE_STATUSES = new Set(["Inactive", "Suspended"]);

export function useEmployeesOverview() {
  const query = useQuery({
    queryKey: ["employeesOverview"],
    queryFn: fetchEmployeesOverview,
    staleTime: 1000 * 60 * 5,
  });

  const data = query.data || [];

  // ======================
  // GROUPED DATA
  // ======================
  const departmentData = useMemo(
    () => groupCount(data, "department.name"),
    [data],
  );

  const statusData = useMemo(
    () => groupCount(data, "employment_status.name"),
    [data],
  );

  const normalizedStatusData = useMemo(() => {
    const map = {
      Active: "Active",
      Probation: "Active",
      "On Leave": "Active",
      Sabbatical: "Active",

      Terminated: "Inactive",
      Resigned: "Inactive",
      Retired: "Inactive",
      "Terminated Notice": "Inactive",
      Inactive: "Inactive",
      Suspended: "Inactive",
    };

    const grouped = {};

    data.forEach((e) => {
      const raw = e.employment_status?.name;
      const key = map[raw] || "Other";

      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value,
    }));
  }, [data]);

  const nationalityData = useMemo(
    () => groupCount(data, "nationality.name"),
    [data],
  );

  const identificationTypeData = useMemo(
    () => groupCount(data, "identification_type.name"),
    [data],
  );

  const employmentTypeData = useMemo(
    () => groupCount(data, "employment_type.name"),
    [data],
  );

  const terminationData = useMemo(() => {
    const filtered = data.filter((e) => e.termination_reason?.name);
    return groupCount(filtered, "termination_reason.name");
  }, [data]);

  const managerData = useMemo(() => {
    const filtered = data.filter((e) => e.manager?.full_name);
    return groupCount(filtered, "manager.full_name");
  }, [data]);

  // ======================
  // INSIGHTS
  // ======================
  const employeesWithoutManager = useMemo(
    () => data.filter((e) => !e.manager?.id),
    [data],
  );

  const employeesWithManager = useMemo(
    () => data.filter((e) => e.manager?.id),
    [data],
  );

  const activeEmployees = useMemo(
    () => data.filter((e) => ACTIVE_STATUSES.has(e.employment_status?.name)),
    [data],
  );

  const inactiveEmployees = useMemo(
    () => data.filter((e) => INACTIVE_STATUSES.has(e.employment_status?.name)),
    [data],
  );

  const terminatedEmployees = useMemo(
    () =>
      data.filter((e) => TERMINATED_STATUSES.has(e.employment_status?.name)),
    [data],
  );

  const employeesMissingProfile = useMemo(
    () => data.filter((e) => !e.profile),
    [data],
  );

  const topDepartments = useMemo(() => {
    return [...departmentData].sort((a, b) => b.value - a.value).slice(0, 5);
  }, [departmentData]);

  const workforceCompositionData = useMemo(() => {
    return groupCount(data, "employment_type.name");
  }, [data]);

  const terminationRate = useMemo(() => {
    return data.length > 0
      ? Number(((terminatedEmployees.length / data.length) * 100).toFixed(1))
      : 0;
  }, [data, terminatedEmployees]);

  // ======================
  // TEAM SIZE (🔥 IMPORTANT)
  // ======================
  const fullTeamSizeData = useMemo(() => {
    const filtered = data.filter((e) => e.manager?.full_name);
    return groupCount(filtered, "manager.full_name");
  }, [data]);

  const teamSizeData = useMemo(() => {
    return [...fullTeamSizeData].sort((a, b) => b.value - a.value).slice(0, 5);
  }, [fullTeamSizeData]);

  // ======================
  // UTILIZATION-LIKE (Org Structure)
  // ======================
  const managementCoverageData = useMemo(() => {
    return [
      { name: "Assigned", value: employeesWithManager.length },
      { name: "Unassigned", value: employeesWithoutManager.length },
    ];
  }, [employeesWithManager, employeesWithoutManager]);

  // ======================
  // KPI LAYER
  // ======================
  const kpis = useMemo(() => {
    const avgTeamSize =
      fullTeamSizeData.length > 0
        ? (
            fullTeamSizeData.reduce((sum, m) => sum + m.value, 0) /
            fullTeamSizeData.length
          ).toFixed(1)
        : 0;

    return {
      totalEmployees: data.length,
      activeEmployees: activeEmployees.length,
      inactiveEmployees: inactiveEmployees.length,
      terminatedEmployees: terminatedEmployees.length,
      employeesWithoutManager: employeesWithoutManager.length,
      avgTeamSize,
      terminationRate, // ✅ Added here instead of the return block
    };
  }, [
    data.length, // ✅ Added missing dependency
    activeEmployees,
    inactiveEmployees,
    terminatedEmployees,
    employeesWithoutManager,
    fullTeamSizeData,
    terminationRate, // ✅ Added missing dependency
  ]);

  // ======================
  // FINAL EXPORT
  // ======================
  return {
    ...query,

    // grouped
    departmentData,
    statusData: normalizedStatusData,
    rawStatusData: statusData,
    workforceCompositionData,
    nationalityData,
    identificationTypeData,
    terminationData,
    managerData,
    employmentTypeData,

    // insights
    employeesWithoutManager,
    employeesWithManager,
    activeEmployees,
    inactiveEmployees,
    terminatedEmployees,
    employeesMissingProfile,

    // advanced
    teamSizeData,
    fullTeamSizeData,
    managementCoverageData,
    topDepartments,

    // KPIs
    kpis,
  };
}
