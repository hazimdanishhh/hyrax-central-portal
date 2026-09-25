import { useRef } from "react";
import {
  CalendarXIcon,
  ChartLineUpIcon,
  ChartPieSliceIcon,
  GaugeIcon,
  WarningCircleIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { useResolvedPath } from "react-router";
import CardLayout from "@/components/cardLayout/CardLayout";
import ChartCard from "@/components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "@/components/chartCard/HorizontalBarChartRenderer";
import LineChartRenderer from "@/components/chartCard/LineChartRenderer";
import PieChartRenderer from "@/components/chartCard/PieChartRenderer";
import {
  ATTENDANCE_DAY_STATE_COLORS,
  BLUE_COLOR,
  GREEN_COLOR,
  PURPLE_COLOR,
  RED_COLOR,
  WORK_CHANNEL_COLORS,
  YELLOW_COLOR,
} from "@/components/chartCard/chartColors";
import ActiveFiltersBar from "@/components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "@/components/crud/noResult/NoResult";
import OverviewCards from "@/components/crud/overviewCards/OverviewCards";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import PayrollCycleFilterBar from "@/components/payrollCycleFilterBar/PayrollCycleFilterBar";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import ExportActions from "@/components/exportActions/ExportActions";
import { useEmployee } from "@/context/EmployeeContext";
import useSubordinatesPublic from "@/features/hr/employees/public/hooks/useSubordinatesPublic";
import useDashboardQuery from "@/hooks/useDashboardQuery";
import { getAttendanceOverviewConfig } from "@/pages/user/hr/attendanceManagement/overview/overviewConfig";
import { fetchTeamAttendanceDashboard } from "@/features/employee/attendance/private/api/teamAttendanceService";
import { getTeamAttendanceOverviewFilterConfig } from "./filterConfig";
import { toLabelledBreakdown } from "@/functions/attendanceDayState";
import buildFilterUrl from "@/functions/convertFilter";

/**
 * Team Attendance Overview -- a manager's direct reports only, via the new
 * p_manager_id param on get_attendance_dashboard. Reuses HR's tile/chart
 * config completely unchanged: every tile and chart (including the Top
 * Absenteeism/Top Overtime leaderboards, and the 2026-09-25 Data Quality &
 * Reconciliation section) is meaningful scoped to a team, unlike My
 * Attendance where a "leaderboard of one" doesn't make sense.
 */
export default function TeamAttendanceOverview() {
  const dashboardRef = useRef(null);
  // Chart clicks open in a new tab via window.open, which needs an
  // already-resolved absolute path (see AttendanceOverview.jsx's own
  // comment for the full "../list resolved to the wrong parent" bug this
  // fixes).
  const listPath = useResolvedPath("../list").pathname;
  const { employee } = useEmployee();

  const { data: subordinates = [], isLoading: subordinatesLoading } =
    useSubordinatesPublic(employee?.id);

  const {
    data: dashboard,
    filters,
    activeFilters,
    hasActiveFilters,
    setFilters,
    resetParams,
    isLoading: dashboardLoading,
    isFetching: dashboardFetching,
    error: dashboardError,
  } = useDashboardQuery({
    queryKey: "team_attendance_dashboard",
    queryFn: fetchTeamAttendanceDashboard(employee?.id),
    enabled: Boolean(employee?.id),
  });

  const filterConfig = getTeamAttendanceOverviewFilterConfig({ subordinates });

  const isLoading = dashboardLoading || subordinatesLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError;

  const kpis = dashboard?.kpis ?? {};
  const isPeriodFiltered = Boolean(filters.startDate) && Boolean(filters.endDate);
  const overviewItems = getAttendanceOverviewConfig(kpis, isPeriodFiltered, filters);

  // Same REGULAR/ACTIONABLE subtitle vocabulary the KPI tiles use -- see
  // DASHBOARD-CONVENTIONS.md §4b/Part C.
  const periodLabel = isPeriodFiltered ? "This Period" : "This Month";
  const actionableLabel = isPeriodFiltered ? "This Period" : "Current Backlog";

  const chartBaseFilter = {
    ...(filters.employee && { employee: filters.employee }),
  };
  // The charts read from period_rows, which defaults to This Month (see HR's
  // overviewConfig.js/get_attendance_dashboard_rpc.sql) -- a "View All" link
  // must match that default exactly.
  const chartToday = new Date().toISOString().slice(0, 10);
  const chartMonthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;
  const chartPeriodFilter = {
    startDate: filters.startDate || chartMonthStart,
    endDate: filters.endDate || chartToday,
  };
  const chartActionableFilter = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};

  // Chart-element drill-through (2026-09-25 -- see AttendanceOverview.jsx's
  // own comment for the full rationale, mirrored here unchanged). Returns a
  // URL rather than navigating -- HorizontalBarChartRenderer/
  // PieChartRenderer/LineChartRenderer each open it in a new tab themselves.
  const goToRegular = (filter) =>
    filter
      ? `${listPath}${buildFilterUrl({ ...chartBaseFilter, ...chartPeriodFilter, ...filter })}`
      : null;
  const goToActionable = (filter) =>
    filter
      ? `${listPath}${buildFilterUrl({ ...chartBaseFilter, ...chartActionableFilter, ...filter })}`
      : null;
  const goToDated = (filter) =>
    filter ? `${listPath}${buildFilterUrl({ ...chartBaseFilter, ...filter })}` : null;

  // Raw day_state values from the RPC, relabelled through the single
  // vocabulary module -- chartColors' keys are the labels, so an
  // unmapped slice would silently render grey.
  const dayStateBreakdownData = toLabelledBreakdown(
    dashboard?.dayStateBreakdownData,
  );
  const departmentAttendanceData = dashboard?.departmentAttendanceData ?? [];
  const workChannelMixData = dashboard?.workChannelMixData ?? [];
  const topAbsenteeismData = dashboard?.topAbsenteeismData ?? [];
  const topOvertimeData = dashboard?.topOvertimeData ?? [];
  const leaveTypeBreakdownData = dashboard?.leaveTypeBreakdownData ?? [];

  const evidenceQualityBreakdownData =
    dashboard?.evidenceQualityBreakdownData ?? [];
  const reconciliationReasonsBreakdownData =
    dashboard?.reconciliationReasonsBreakdownData ?? [];
  const topNeedsReconciliationData =
    dashboard?.topNeedsReconciliationData ?? [];
  const topDataQualityData = dashboard?.topDataQualityData ?? [];

  const topLeaveDaysByEmployeeData =
    dashboard?.topLeaveDaysByEmployeeData ?? [];
  const leaveDaysByDepartmentData = dashboard?.leaveDaysByDepartmentData ?? [];

  // The RPC switches to weekly buckets once the range exceeds 60 days.
  // Read the bucket it reports rather than assuming daily -- the
  // subtitles used to hardcode "By Day", so a year-to-date view
  // presented weekly points as daily ones.
  const trendBucketLabel =
    dashboard?.trendBucket === "week" ? "By Week" : "By Day";

  const dailyAttendanceTrendData =
    dashboard?.dailyAttendanceTrendData?.map((d) => ({
      name: d.period,
      "Attendance Rate": d.roster_count
        ? Math.round((d.present_count / d.roster_count) * 100)
        : 0,
      filter: d.filter,
    })) ?? [];

  const hoursWorkedTrendData =
    dashboard?.hoursWorkedTrendData?.map((d) => ({
      name: d.period,
      "Avg Hours": d.avg_hours ?? 0,
      filter: d.filter,
    })) ?? [];

  const attendanceRateTrailing12MonthsData =
    dashboard?.attendanceRateTrailing12MonthsData?.map((d) => ({
      name: d.period,
      "Attendance Rate": d.value ?? 0,
      filter: d.filter,
    })) ?? [];

  return (
    <>
      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        enableDateRange
        disableSearch
        isLoading={isLoading}
        isError={isError}
      />

      <PayrollCycleFilterBar filters={filters} onFilterChange={setFilters} />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.8rem",
        }}
      >
        <ExportActions
          targetRef={dashboardRef}
          fileName="Team_Attendance_Overview_Report"
          reportTitle="Team Attendance Overview"
          logoUrl="/logos/logo.png"
          subtitle={
            filters.startDate && filters.endDate
              ? `${filters.startDate} to ${filters.endDate}`
              : "All Time"
          }
        />
      </div>

      <div
        ref={dashboardRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
        }}
      >
        {hasActiveFilters && (
          <ActiveFiltersBar
            filters={activeFilters}
            setFilters={setFilters}
            filterConfig={filterConfig}
            resetParams={resetParams}
          />
        )}

        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : isError ? (
          <CardLayout style="cardLayoutFlexFull">
            <NoResult title="Error loading attendance overview." />
          </CardLayout>
        ) : (
          <>
            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ marginBottom: "1rem" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <GaugeIcon size={24} />
                    <h2 className="textL textBold">Attendance KPIs</h2>
                  </div>
                  <p className="textXS textLight">
                    {isPeriodFiltered
                      ? "Your team's attendance for the selected period, and what needs your attention."
                      : "Your team's attendance this month, and what needs your attention right now."}
                  </p>
                </div>

                <OverviewCards items={overviewItems} />
              </div>
            </div>

            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <ChartLineUpIcon size={24} />
                    <h2 className="textL textBold">Attendance Trends</h2>
                  </div>
                  <p className="textXS textLight">
                    Daily attendance rate and average hours worked over the
                    selected period, plus a 12-month trend for seasonal
                    context, for your team.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Daily Attendance Rate"
                    subtitle={`Present vs Team Roster, ${trendBucketLabel} — ${periodLabel}`}
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={dailyAttendanceTrendData}
                      lines={[{ dataKey: "Attendance Rate", color: BLUE_COLOR }]}
                      onPointClick={(payload) => goToDated(payload?.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Hours Worked"
                    subtitle={`Average Hours Worked, ${trendBucketLabel} — ${periodLabel}`}
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={hoursWorkedTrendData}
                      lines={[{ dataKey: "Avg Hours", color: GREEN_COLOR }]}
                      onPointClick={(payload) => goToDated(payload?.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Attendance Rate — Trailing 12 Months"
                    subtitle="Not Affected by the Date Filter"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={attendanceRateTrailing12MonthsData}
                      lines={[{ dataKey: "Attendance Rate", color: BLUE_COLOR }]}
                      onPointClick={(payload) => goToDated(payload?.filter)}
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>

            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <ChartPieSliceIcon size={24} />
                    <h2 className="textL textBold">
                      By Department & Work Pattern
                    </h2>
                  </div>
                  <p className="textXS textLight">
                    Your team's attendance rate by department, day-state
                    composition, and hardware-scan vs app/remote channel mix,
                    this period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Departments"
                    subtitle={`Attendance Rate (%), ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      calendarType: "ordinary",
                      ...chartPeriodFilter,
                    }}
                  >
                    <HorizontalBarChartRenderer
                      data={departmentAttendanceData}
                      colorMap={BLUE_COLOR}
                      onBarClick={(entry) => goToRegular(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Status Breakdown"
                    subtitle={`By Record, ${periodLabel} (Excludes Weekends)`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      calendarType: "ordinary",
                      ...chartPeriodFilter,
                    }}
                  >
                    <PieChartRenderer
                      data={dayStateBreakdownData}
                      mode="semantic"
                      colorMap={ATTENDANCE_DAY_STATE_COLORS}
                      onSliceClick={(entry) => goToRegular(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Work Channel Mix"
                    subtitle={`Office (Hardware Scan) vs Remote (App), ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      calendarType: "ordinary",
                      ...chartPeriodFilter,
                    }}
                  >
                    <PieChartRenderer
                      data={workChannelMixData}
                      mode="semantic"
                      colorMap={WORK_CHANNEL_COLORS}
                      onSliceClick={(entry) => goToRegular(entry.filter)}
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>

            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <WarningOctagonIcon size={24} />
                    <h2 className="textL textBold">
                      Data Quality & Reconciliation
                    </h2>
                  </div>
                  <p className="textXS textLight">
                    What's driving your team's Needs Reconciliation and Data
                    Quality backlog right now, and who to follow up with.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Data Quality Breakdown"
                    subtitle={`Outstanding Records, ${actionableLabel}`}
                    style="cardGapSmall"
                  >
                    <PieChartRenderer
                      data={evidenceQualityBreakdownData}
                      onSliceClick={(entry) => goToActionable(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Reconciliation Reasons"
                    subtitle={`Outstanding Records, ${actionableLabel}`}
                    style="cardGapSmall"
                  >
                    <HorizontalBarChartRenderer
                      data={reconciliationReasonsBreakdownData}
                      colorMap={RED_COLOR}
                      onBarClick={(entry) => goToActionable(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Top Needs Reconciliation"
                    subtitle={`By Outstanding Records, ${actionableLabel}`}
                    style="cardGapSmall"
                  >
                    <HorizontalBarChartRenderer
                      data={topNeedsReconciliationData}
                      colorMap={RED_COLOR}
                      onBarClick={(entry) => goToActionable(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Top Data Quality Issues"
                    subtitle={`By Outstanding Records, ${actionableLabel}`}
                    style="cardGapSmall"
                  >
                    <HorizontalBarChartRenderer
                      data={topDataQualityData}
                      colorMap={YELLOW_COLOR}
                      onBarClick={(entry) => goToActionable(entry.filter)}
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>

            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <WarningCircleIcon size={24} />
                    <h2 className="textL textBold">Needs Attention</h2>
                  </div>
                  <p className="textXS textLight">
                    Team members with the most absent days and the most
                    overtime hours this period -- who to follow up with.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Top Absenteeism"
                    subtitle={`By Absent Days, ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    // calendarType: "ordinary" mirrors topAbsenteeismData's
                    // own `and not is_weekend` guard in
                    // get_attendance_dashboard_rpc.sql -- see the identical
                    // fix on HR's AttendanceOverview.jsx. Without it a manager
                    // clicking through landed on roughly twice the days the
                    // chart had just plotted, padded with ordinary weekends.
                    viewAllFilter={{
                      ...chartBaseFilter,
                      dayState: "absent",
                      ...chartPeriodFilter,
                    }}
                  >
                    <HorizontalBarChartRenderer
                      data={topAbsenteeismData}
                      colorMap={RED_COLOR}
                      onBarClick={(entry) => goToRegular(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Top Overtime"
                    subtitle={`By Overtime Hours, ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      overtimeOnly: "true",
                      ...chartPeriodFilter,
                    }}
                  >
                    <HorizontalBarChartRenderer
                      data={topOvertimeData}
                      colorMap={YELLOW_COLOR}
                      onBarClick={(entry) => goToRegular(entry.filter)}
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>

            <div className="pdfOverviewSection">
              <div style={{ justifyContent: "start", textAlign: "start" }}>
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}
                  >
                    <CalendarXIcon size={24} />
                    <h2 className="textL textBold">Leave</h2>
                  </div>
                  <p className="textXS textLight">
                    Your team's leave days by type, and who's taking the
                    most, this period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Leave by Type"
                    subtitle={`Total Days, ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      onLeave: "true",
                      ...chartPeriodFilter,
                    }}
                  >
                    <HorizontalBarChartRenderer
                      data={leaveTypeBreakdownData}
                      colorMap={PURPLE_COLOR}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Top Leave Days by Employee"
                    subtitle={`Total Days, ${periodLabel}`}
                    style="cardGapSmall"
                  >
                    <HorizontalBarChartRenderer
                      data={topLeaveDaysByEmployeeData}
                      colorMap={PURPLE_COLOR}
                      onBarClick={(entry) =>
                        goToRegular({ onLeave: "true", ...entry.filter })
                      }
                    />
                  </ChartCard>

                  <ChartCard
                    title="Leave Days by Department"
                    subtitle={`Total Days, ${periodLabel}`}
                    style="cardGapSmall"
                  >
                    <HorizontalBarChartRenderer
                      data={leaveDaysByDepartmentData}
                      colorMap={PURPLE_COLOR}
                      onBarClick={(entry) =>
                        goToRegular({ onLeave: "true", ...entry.filter })
                      }
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
