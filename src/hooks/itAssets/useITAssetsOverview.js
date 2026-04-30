import { useQuery } from "@tanstack/react-query";
import { fetchITAssetsOverview } from "../../services/itAssetsServices/itAssetsAnalyticsService";
import { useMemo } from "react";
import { groupCount } from "../../functions/dataTransform";

export function useITAssetsOverview() {
  const query = useQuery({
    queryKey: ["itAssetsOverview"],
    queryFn: fetchITAssetsOverview,
    staleTime: 1000 * 60 * 5,
  });

  const data = query.data || [];

  // ======================
  // CONFIG (CENTRAL RULES)
  // ======================
  const RISK_CONDITIONS = new Set(["Poor", "Damaged"]);

  // ======================
  // BASIC GROUPED DATA
  // ======================
  const categoryData = useMemo(
    () => groupCount(data, "asset_category.name"),
    [data],
  );

  const statusData = useMemo(
    () => groupCount(data, "asset_status.name"),
    [data],
  );

  const subcategoryData = useMemo(
    () => groupCount(data, "asset_subcategory.name"),
    [data],
  );

  const departmentData = useMemo(
    () => groupCount(data, "asset_department.name"),
    [data],
  );

  const conditionData = useMemo(
    () => groupCount(data, "asset_condition.name"),
    [data],
  );

  const osData = useMemo(
    () => groupCount(data, "operating_system.name"),
    [data],
  );

  // ======================
  // INSIGHT LAYER (IMPORTANT)
  // ======================

  const riskAssets = useMemo(() => {
    return data.filter((a) => RISK_CONDITIONS.has(a.asset_condition?.name));
  }, [data]);

  const unassignedAssets = useMemo(() => {
    return data.filter((a) => !a.asset_user?.full_name);
  }, [data]);

  const assignedAssets = useMemo(() => {
    return data.filter((a) => a.asset_user?.full_name);
  }, [data]);

  // Asset assignment ratio (VERY useful KPI)
  const utilizationData = useMemo(() => {
    return [
      { name: "Assigned", value: assignedAssets.length },
      { name: "Unassigned", value: unassignedAssets.length },
    ];
  }, [assignedAssets, unassignedAssets]);

  // Risk breakdown (better than just list)
  const riskData = useMemo(() => {
    const safe = data.length - riskAssets.length;

    return [
      { name: "Safe", value: safe },
      { name: "Risk", value: riskAssets.length },
    ];
  }, [data, riskAssets]);

  // ======================
  // KPI LAYER (DASHBOARD CORE)
  // ======================
  const kpis = useMemo(() => {
    return {
      totalAssets: data.length,
      activeAssets: statusData.find((s) => s.name === "Active")?.value || 0,
      riskAssets: riskAssets.length,
      unassignedAssets: unassignedAssets.length,
      assignedAssets: assignedAssets.length,
    };
  }, [data, statusData, riskAssets, unassignedAssets, assignedAssets]);

  // ======================
  // FINAL EXPORT
  // ======================
  return {
    ...query,

    // grouped charts
    categoryData,
    statusData,
    subcategoryData,
    departmentData,
    conditionData,
    osData,

    // insight charts
    riskData,
    utilizationData,

    // lists (for tables / drilldowns)
    riskAssets,
    unassignedAssets,
    assignedAssets,

    // KPIs
    kpis,
  };
}
