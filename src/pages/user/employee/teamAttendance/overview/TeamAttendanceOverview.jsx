import { useRef } from "react";
import {
  CalendarXIcon,
  ChartLineUpIcon,
  ChartPieSliceIcon,
  GaugeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import CardLayout from "@/components/cardLayout/CardLayout";
import ChartCard from "@/components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "@/components/chartCard/HorizontalBarChartRenderer";
import LineChartRenderer from "@/components/chartCard/LineChartRenderer";
import PieChartRenderer from "@/components/chartCard/PieChartRenderer";
import {
  ATTENDANCE_FLAG_COLORS,
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

/**
 * Team Attendance Overview -- a manager's direct reports only, via the new
 * p_manager_id param on get_attendance_dashboard. Reuses HR's tile/chart
 * config completely unchanged: every tile and chart (including the Top
 * Absenteeism/Top Overtime leaderboards) is meaningful scoped to a team,
 * unlike My Attendance where a "leaderboard of one" doesn't make sense.
 */
export default function TeamAttendanceOverview() {
  const dashboardRef = useRef(null);
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

  const chartBaseFilter = {
    ...(filters.employee && { employee: filters.employee }),
  };
  const chartToday = new Date().toISOString().slice(0, 10);
  const chartMonthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;
  const chartPeriodFilter = {
    startDate: filters.startDate || chartMonthStart,
    endDate: filters.endDate || chartToday,
  };

  const hrFlagBreakdownData = dashboard?.hrFlagBreakdownData ?? [];
  const departmentAttendanceData = dashboard?.departmentAttendanceData ?? [];
  const workChannelMixData = dashboard?.workChannelMixData ?? [];
  const topAbsenteeismData = dashboard?.topAbsenteeismData ?? [];
  const topOvertimeData = dashboard?.topOvertimeData ?? [];
  const leaveTypeBreakdownData = dashboard?.leaveTypeBreakdownData ?? [];

  const dailyAttendanceTrendData =
    dashboard?.dailyAttendanceTrendData?.map((d) => ({
      name: d.period,
      "Attendance Rate": d.roster_count
        ? Math.round((d.present_count / d.roster_count) * 100)
        : 0,
    })) ?? [];

  const hoursWorkedTrendData =
    dashboard?.hoursWorkedTrendData?.map((d) => ({
      name: d.period,
      "Avg Hours": d.avg_hours ?? 0,
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
                      ? "Your team's attendance for the selected period, what needs your action, and how it's trending."
                      : "Who's here today, what needs your action, and how your team's attendance is trending this period."}
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
                    selected period, for your team.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Daily Attendance Rate"
                    subtitle="Present vs Team Roster, By Day"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={dailyAttendanceTrendData}
                      lines={[{ dataKey: "Attendance Rate", color: BLUE_COLOR }]}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Hours Worked"
                    subtitle="Average Hours Worked, By Day"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={hoursWorkedTrendData}
                      lines={[{ dataKey: "Avg Hours", color: GREEN_COLOR }]}
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
                    Your team's attendance rate by department, anomaly
                    composition, and hardware-scan vs app/remote channel mix,
                    this period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Departments"
                    subtitle="Attendance Rate (%), This Period"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      workingDayOnly: "true",
                      ...chartPeriodFilter,
                    }}
                  >
                    <HorizontalBarChartRenderer
                      data={departmentAttendanceData}
                      colorMap={BLUE_COLOR}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Status Breakdown"
                    subtitle="By Record, This Period (Excludes Weekend / Rest Day)"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      workingDayOnly: "true",
                      ...chartPeriodFilter,
                    }}
                  >
                    <PieChartRenderer
                      data={hrFlagBreakdownData}
                      mode="semantic"
                      colorMap={ATTENDANCE_FLAG_COLORS}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Work Channel Mix"
                    subtitle="Office (Hardware Scan) vs Remote (App), This Period"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      workingDayOnly: "true",
                      ...chartPeriodFilter,
                    }}
                  >
                    <PieChartRenderer
                      data={workChannelMixData}
                      mode="semantic"
                      colorMap={WORK_CHANNEL_COLORS}
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
                    subtitle="By Absent Days, This Period"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      hrFlag: "Absent",
                      ...chartPeriodFilter,
                    }}
                  >
                    <HorizontalBarChartRenderer
                      data={topAbsenteeismData}
                      colorMap={RED_COLOR}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Top Overtime"
                    subtitle="By Overtime Hours, This Period"
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
                    Your team's leave days by type, this period.
                  </p>
                </div>

                <CardLayout>
                  <ChartCard
                    title="Leave by Type"
                    subtitle="Total Days, This Period"
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
                </CardLayout>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
