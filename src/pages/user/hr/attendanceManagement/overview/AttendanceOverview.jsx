import {
  ChartLineUpIcon,
  ChartPieSliceIcon,
  GaugeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  ATTENDANCE_FLAG_COLORS,
  BLUE_COLOR,
  GREEN_COLOR,
  RED_COLOR,
  WORK_CHANNEL_COLORS,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { fetchAttendanceDashboard } from "../../../../../features/hr/attendance/private/api/fetchAttendanceDashboard";
import { useAttendanceActivitiesMetadata } from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useDashboardQuery from "../../../../../hooks/useDashboardQuery";
import { getAttendanceOverviewFilterConfig } from "./filterConfig";
import { getAttendanceOverviewConfig } from "./overviewConfig";
import ExportActions from "../../../../../components/exportActions/ExportActions";
import { useRef } from "react";

export default function AttendanceOverview() {
  const dashboardRef = useRef(null);

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
    queryKey: "attendance_dashboard",
    queryFn: fetchAttendanceDashboard,
  });

  // Reuses the List page's existing metadata hook (already fetches
  // employees/departments/attendanceTypes, cached 10min) rather than adding
  // a second, narrower fetch just for these two filter dropdowns -- same
  // technique EmployeeOverview uses for its own department filter.
  const {
    employees,
    departments,
    isLoading: metadataLoading,
    error: metadataError,
  } = useAttendanceActivitiesMetadata();

  const filterConfig = getAttendanceOverviewFilterConfig({
    departments,
    employees,
  });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError || metadataError;

  const kpis = dashboard?.kpis ?? {};
  // Mirrors get_attendance_dashboard_rpc.sql's own v_has_period test exactly
  // -- the RPC already branches every affected kpis.* value between its
  // today/backlog and period-scoped variants; this only picks which
  // labels/sublabels to render for whichever value came back.
  const isPeriodFiltered = Boolean(filters.startDate) && Boolean(filters.endDate);
  const overviewItems = getAttendanceOverviewConfig(kpis, isPeriodFiltered, filters);

  // Same baseFilter/periodFilter shape overviewConfig.js builds internally
  // for tile links -- duplicated here (rather than exported) since these
  // three chart-card "View All" links are plain JSX props, not part of the
  // tile config array itself.
  const chartBaseFilter = {
    ...(filters.department && { department: filters.department }),
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

  // Raw RPC rows carry present_count/roster_count (and avg_hours) rather
  // than a pre-computed rate -- derived here, same "shape the chart data in
  // the page, not the RPC" convention EmployeeOverview's headcountTrendData
  // already follows.
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
      {/* SEARCH AND FILTER BAR -- period (defaults to This Month server-side
          when no range is selected, see get_attendance_dashboard_rpc.sql),
          department, and single-employee (for per-employee/payroll-prep
          analytics) */}
      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        enableDateRange
        disableSearch
        isLoading={isLoading}
        isError={isError}
      />

      {/* EXPORT */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.8rem",
        }}
      >
        <ExportActions
          targetRef={dashboardRef}
          fileName="Attendance_Overview_Report"
          reportTitle="Attendance Overview"
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
        {/* ACTIVE FILTERS */}
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
              {/* TIER 1: HEADLINE SUMMARY */}
              <div
                style={{
                  justifyContent: "start",
                  textAlign: "start",
                }}
              >
                <div style={{ marginBottom: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                    }}
                  >
                    <GaugeIcon size={24} />
                    <h2 className="textL textBold">Attendance KPIs</h2>
                  </div>
                  <p className="textXS textLight">
                    {isPeriodFiltered
                      ? "Attendance for the selected period, what needs HR action, and how it's trending."
                      : "Who's here today, what needs HR action, and how attendance is trending this period."}
                  </p>
                </div>

                <OverviewCards items={overviewItems} />
              </div>
            </div>

            <div className="pdfOverviewSection">
              {/* ATTENDANCE TRENDS */}
              <div
                style={{
                  justifyContent: "start",
                  textAlign: "start",
                }}
              >
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                    }}
                  >
                    <ChartLineUpIcon size={24} />
                    <h2 className="textL textBold">Attendance Trends</h2>
                  </div>
                  <p className="textXS textLight">
                    Daily attendance rate and average hours worked over the
                    selected period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Daily Attendance Rate"
                    subtitle="Present vs Active Roster, By Day"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={dailyAttendanceTrendData}
                      lines={[
                        { dataKey: "Attendance Rate", color: BLUE_COLOR },
                      ]}
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
              {/* BY DEPARTMENT & WORK PATTERNS */}
              <div
                style={{
                  justifyContent: "start",
                  textAlign: "start",
                }}
              >
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                    }}
                  >
                    <ChartPieSliceIcon size={24} />
                    <h2 className="textL textBold">
                      By Department & Work Pattern
                    </h2>
                  </div>
                  <p className="textXS textLight">
                    Attendance rate by department, anomaly composition, and
                    hardware-scan vs app/remote channel mix, this period.
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
              <div
                style={{
                  justifyContent: "start",
                  textAlign: "start",
                }}
              >
                <div style={{ margin: "1rem 0" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                    }}
                  >
                    <WarningCircleIcon size={24} />
                    <h2 className="textL textBold">Needs Attention</h2>
                  </div>
                  <p className="textXS textLight">
                    Employees with the most absent days and the most overtime
                    hours this period -- who HR should follow up with.
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
          </>
        )}
      </div>
    </>
  );
}
