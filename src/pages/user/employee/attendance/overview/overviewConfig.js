import { getAttendanceOverviewConfig as getHRAttendanceOverviewConfig } from "@/pages/user/hr/attendanceManagement/overview/overviewConfig";

// Reuses HR's tile config unchanged -- every tile is meaningful scoped to a
// single employee via p_employee_id, except one sub-metric: "Active
// Headcount" under the Attendance Rate tile is always exactly 1 when scoped
// to self, which isn't useful framing for "my own" attendance. Drop it
// rather than forking the whole ~300-line config for one row.
export function getMyAttendanceOverviewConfig(kpis, isPeriodFiltered, filters) {
  const tiles = getHRAttendanceOverviewConfig(kpis, isPeriodFiltered, filters);

  return tiles.map((tile) => {
    if (tile.label !== "Attendance Rate" || !tile.metrics) return tile;

    return {
      ...tile,
      metrics: tile.metrics.filter((m) => m.label !== "Active Headcount"),
    };
  });
}
