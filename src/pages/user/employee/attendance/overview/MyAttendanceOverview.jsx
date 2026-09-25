import { useRef } from "react";
import {
  CalendarXIcon,
  ChartLineUpIcon,
  ChartPieSliceIcon,
  GaugeIcon,
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
  WORK_CHANNEL_COLORS,
} from "@/components/chartCard/chartColors";
import NoResult from "@/components/crud/noResult/NoResult";
import OverviewCards from "@/components/crud/overviewCards/OverviewCards";
import LoadingIcon from "@/components/loadingIcon/LoadingIcon";
import PayrollCycleFilterBar from "@/components/payrollCycleFilterBar/PayrollCycleFilterBar";
import SearchFilterBar from "@/components/searchFilterBar/SearchFilterBar";
import ExportActions from "@/components/exportActions/ExportActions";
import { useEmployee } from "@/context/EmployeeContext";
import useDashboardQuery from "@/hooks/useDashboardQuery";
import { fetchMyAttendanceDashboard } from "@/features/employee/attendance/private/api/myAttendanceService";
import { getMyAttendanceOverviewConfig } from "./overviewConfig";
import { toLabelledBreakdown } from "@/functions/attendanceDayState";
import buildFilterUrl from "@/functions/convertFilter";

/**
 * My Attendance Overview -- reuses get_attendance_dashboard unchanged
 * (p_employee_id already scopes every CTE). No employee/department picker
 * (scope is always self); Departments chart, the Needs Attention
 * leaderboards, the Data Quality & Reconciliation section, and the two new
 * Leave-by-employee/department leaderboards are all dropped (meaningless
 * scoped to one person -- see AttendanceOverview.jsx for the full set this
 * page is a reduced version of). Does gain the Trailing-12-Months trend
 * (2026-09-25) -- seasonal context is meaningful even for one person.
 */
export default function MyAttendanceOverview() {
  const dashboardRef = useRef(null);
  // Chart clicks open in a new tab via window.open, which needs an
  // already-resolved absolute path (see AttendanceOverview.jsx's own
  // comment for the full "../list resolved to the wrong parent" bug this
  // fixes).
  const listPath = useResolvedPath("../list").pathname;
  const { employee } = useEmployee();

  const {
    data: dashboard,
    filters,
    setFilters,
    isLoading: dashboardLoading,
    isFetching: dashboardFetching,
    error: dashboardError,
  } = useDashboardQuery({
    queryKey: "my_attendance_dashboard",
    queryFn: fetchMyAttendanceDashboard(employee?.id),
    enabled: Boolean(employee?.id),
  });

  const isLoading = dashboardLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError;

  const kpis = dashboard?.kpis ?? {};
  const isPeriodFiltered = Boolean(filters.startDate) && Boolean(filters.endDate);
  const overviewItems = getMyAttendanceOverviewConfig(kpis, isPeriodFiltered, filters);

  // Same REGULAR subtitle vocabulary the KPI tiles use -- see
  // DASHBOARD-CONVENTIONS.md §4b/Part C. My Attendance has no ACTIONABLE
  // charts (see file header comment), so only periodLabel is needed here.
  const periodLabel = isPeriodFiltered ? "This Period" : "This Month";

  const chartToday = new Date().toISOString().slice(0, 10);
  const chartMonthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;
  const chartPeriodFilter = {
    startDate: filters.startDate || chartMonthStart,
    endDate: filters.endDate || chartToday,
  };

  // Chart-element drill-through (2026-09-25 -- see AttendanceOverview.jsx's
  // own comment for the full rationale). No chartBaseFilter needed here --
  // this page has no department/employee picker, scope is always self.
  // Returns a URL rather than navigating -- HorizontalBarChartRenderer/
  // PieChartRenderer/LineChartRenderer each open it in a new tab themselves.
  const goToRegular = (filter) =>
    filter ? `${listPath}${buildFilterUrl({ ...chartPeriodFilter, ...filter })}` : null;
  const goToDated = (filter) =>
    filter ? `${listPath}${buildFilterUrl(filter)}` : null;

  // Raw day_state values from the RPC, relabelled through the single
  // vocabulary module -- chartColors' keys are the labels, so an
  // unmapped slice would silently render grey.
  const dayStateBreakdownData = toLabelledBreakdown(
    dashboard?.dayStateBreakdownData,
  );
  const workChannelMixData = dashboard?.workChannelMixData ?? [];
  const leaveTypeBreakdownData = dashboard?.leaveTypeBreakdownData ?? [];

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
        filterConfig={[]}
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
          fileName="My_Attendance_Overview_Report"
          reportTitle="My Attendance Overview"
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
                      ? "Your attendance for the selected period."
                      : "Your attendance this month, and what still needs action."}
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
                    Your daily attendance and average hours worked over the
                    selected period, plus a 12-month trend for seasonal
                    context.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Daily Attendance"
                    subtitle={`Present, ${trendBucketLabel} — ${periodLabel}`}
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
                    subtitle={`Hours Worked, ${trendBucketLabel} — ${periodLabel}`}
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
                    <h2 className="textL textBold">Work Pattern</h2>
                  </div>
                  <p className="textXS textLight">
                    Your status composition and hardware-scan vs app/remote
                    channel mix, this period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Status Breakdown"
                    subtitle={`By Record, ${periodLabel} (Excludes Weekends)`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
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
                    <CalendarXIcon size={24} />
                    <h2 className="textL textBold">Leave</h2>
                  </div>
                  <p className="textXS textLight">
                    Your leave days by type, this period.
                  </p>
                </div>

                <CardLayout>
                  <ChartCard
                    title="Leave by Type"
                    subtitle={`Total Days, ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ onLeave: "true", ...chartPeriodFilter }}
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
