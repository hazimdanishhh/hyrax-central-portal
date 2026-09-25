import {
  CalendarXIcon,
  ChartLineUpIcon,
  ChartPieSliceIcon,
  GaugeIcon,
  WarningCircleIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react";
import { useResolvedPath } from "react-router";

import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  ATTENDANCE_DAY_STATE_COLORS,
  BLUE_COLOR,
  GREEN_COLOR,
  PURPLE_COLOR,
  RED_COLOR,
  WORK_CHANNEL_COLORS,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import PayrollCycleFilterBar from "../../../../../components/payrollCycleFilterBar/PayrollCycleFilterBar";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { fetchAttendanceDashboard } from "../../../../../features/hr/attendance/private/api/fetchAttendanceDashboard";
import { useAttendanceActivitiesMetadata } from "../../../../../features/hr/attendance/private/hooks/useAttendanceActivitiesMetadata";
import useDashboardQuery from "../../../../../hooks/useDashboardQuery";
import { getAttendanceOverviewFilterConfig } from "./filterConfig";
import { getAttendanceOverviewConfig } from "./overviewConfig";
import ExportActions from "../../../../../components/exportActions/ExportActions";
import { useRef } from "react";
import { toLabelledBreakdown } from "@/functions/attendanceDayState";
import buildFilterUrl from "@/functions/convertFilter";

export default function AttendanceOverview() {
  const dashboardRef = useRef(null);
  // Chart clicks open in a NEW TAB via window.open (see the click-through
  // helpers below), which resolves a relative URL against the raw browser
  // path (one segment removed per "..", same as an <a href> would), NOT
  // React Router's own route-tree-aware relative resolution `navigate()`/
  // `Link` use -- "../list" from this page's real route
  // (.../attendance-management/overview) landed on .../hr/list instead of
  // .../attendance-management/list. useResolvedPath resolves it the same
  // way `navigate("../list")` would, so it's computed once here and reused
  // by every click-through helper instead of the bare relative string.
  const listPath = useResolvedPath("../list").pathname;

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
    workLocations,
    isLoading: metadataLoading,
    error: metadataError,
  } = useAttendanceActivitiesMetadata();

  const filterConfig = getAttendanceOverviewFilterConfig({
    departments,
    employees,
    workLocations,
  });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError || metadataError;

  const kpis = dashboard?.kpis ?? {};
  // Whether a date range is actually selected -- only used here to pick
  // which subtitle/sublabel text to render (getAttendanceOverviewConfig
  // below); the RPC itself already returns whichever figures apply
  // (all-time when this is false, the selected period when true).
  const isPeriodFiltered =
    Boolean(filters.startDate) && Boolean(filters.endDate);
  const overviewItems = getAttendanceOverviewConfig(
    kpis,
    isPeriodFiltered,
    filters,
  );

  // Same REGULAR/ACTIONABLE subtitle vocabulary the KPI tiles use
  // (overviewConfig.js), extended down to every chart (2026-09-25 chart
  // restructuring pass -- see DASHBOARD-CONVENTIONS.md §4b/Part C). A user
  // who has learned to read a KPI tile's sublabel reads a chart's subtitle
  // for free -- both say the same two words for the same underlying window.
  const periodLabel = isPeriodFiltered ? "This Period" : "This Month";
  const actionableLabel = isPeriodFiltered
    ? "This Period"
    : "Current Backlog";

  // Same baseFilter/periodFilter/actionableFilter shape overviewConfig.js
  // builds internally for tile links -- duplicated here (rather than
  // exported) since these chart-card links/click-throughs are plain JSX
  // props, not part of the tile config array itself.
  const chartBaseFilter = {
    ...(filters.department && { department: filters.department }),
    ...(filters.employee && { employee: filters.employee }),
  };
  // The charts read from period_rows, which defaults to This Month
  // (get_attendance_dashboard_rpc.sql) -- matches overviewConfig.js's own
  // periodFilter default exactly, so a "View All" link always shows the same
  // range the chart itself represents.
  const chartToday = new Date().toISOString().slice(0, 10);
  const chartMonthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;
  const chartPeriodFilter = {
    startDate: filters.startDate || chartMonthStart,
    endDate: filters.endDate || chartToday,
  };
  // ACTIONABLE charts -- omitted entirely when unfiltered (true backlog,
  // matching the RPC's own unbounded query), the exact selection otherwise.
  // Mirrors overviewConfig.js's own actionableFilter exactly.
  const chartActionableFilter = isPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};

  // Chart-element drill-through (2026-09-25 restructuring pass -- see
  // DASHBOARD-CONVENTIONS.md's chart drill-through section, the new
  // cross-dashboard baseline this pass introduces). Every clickable chart
  // datum now carries its own RPC-computed `filter` object; these three
  // helpers just decide which page-level filters to combine it with,
  // depending on the chart's own family -- a REGULAR bar/pie needs the
  // period range added, an ACTIONABLE one needs the backlog/period range
  // added, and a trend point already IS a date range and needs neither.
  // `filter` is null for a bucket with no sensible single filter (e.g. the
  // "Unassigned" department bucket) -- those return null too, so the
  // renderer's own click-through wrapper treats it as a no-op.
  //
  // These RETURN a URL rather than navigating themselves (changed
  // 2026-09-25) -- HorizontalBarChartRenderer/PieChartRenderer/
  // LineChartRenderer each open whatever URL their callback returns in a new
  // tab, so "how a chart click opens" only needs to change in those three
  // renderer files, not in every page that uses them.
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
  // unmapped slice would silently render grey. `filter` survives the
  // relabelling untouched (toLabelledBreakdown only overwrites `name`).
  const dayStateBreakdownData = toLabelledBreakdown(
    dashboard?.dayStateBreakdownData,
  );
  const departmentAttendanceData = dashboard?.departmentAttendanceData ?? [];
  const workChannelMixData = dashboard?.workChannelMixData ?? [];
  const topAbsenteeismData = dashboard?.topAbsenteeismData ?? [];
  const topOvertimeData = dashboard?.topOvertimeData ?? [];
  const leaveTypeBreakdownData = dashboard?.leaveTypeBreakdownData ?? [];

  // ACTIONABLE-family charts (new 2026-09-25) -- pair with the Needs
  // Reconciliation/Data Quality KPI tiles the same way Top Absenteeism/Top
  // Overtime pair with Attendance Rate/Hours Worked.
  const evidenceQualityBreakdownData =
    dashboard?.evidenceQualityBreakdownData ?? [];
  const reconciliationReasonsBreakdownData =
    dashboard?.reconciliationReasonsBreakdownData ?? [];
  const topNeedsReconciliationData =
    dashboard?.topNeedsReconciliationData ?? [];
  const topDataQualityData = dashboard?.topDataQualityData ?? [];

  // New Leave leaderboards, per HR's own ask.
  const topLeaveDaysByEmployeeData =
    dashboard?.topLeaveDaysByEmployeeData ?? [];
  const leaveDaysByDepartmentData = dashboard?.leaveDaysByDepartmentData ?? [];

  // Raw RPC rows carry present_count/roster_count (and avg_hours) rather
  // than a pre-computed rate -- derived here, same "shape the chart data in
  // the page, not the RPC" convention EmployeeOverview's headcountTrendData
  // already follows.
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

  // FIXED-WINDOW family (new 2026-09-25) -- always trailing 12 months,
  // ignores the page's date filter entirely (see trailing_12_months_rows in
  // the RPC). Seasonal context a "This Month"-scoped trend can't show.
  const attendanceRateTrailing12MonthsData =
    dashboard?.attendanceRateTrailing12MonthsData?.map((d) => ({
      name: d.period,
      "Attendance Rate": d.value ?? 0,
      filter: d.filter,
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

      {/* PAYROLL CYCLE -- additive to SearchFilterBar's own calendar-month
          presets above, same side-by-side stacking Sales Reports uses for
          SearchFilterBar + FiscalYearFilterBar. Writes the same
          filters.startDate/endDate keys, so every KPI/chart/table on this
          page already responds to it with zero extra wiring. */}
      <PayrollCycleFilterBar filters={filters} onFilterChange={setFilters} />

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
                      ? "Attendance for the selected period, and what needs HR's attention."
                      : "This month's attendance, and what needs HR's attention right now."}
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
                    selected period, plus a 12-month trend for seasonal
                    context.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Daily Attendance Rate"
                    subtitle={`Present vs Active Roster, ${trendBucketLabel} — ${periodLabel}`}
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={dailyAttendanceTrendData}
                      lines={[
                        { dataKey: "Attendance Rate", color: BLUE_COLOR },
                      ]}
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
                      lines={[
                        { dataKey: "Attendance Rate", color: BLUE_COLOR },
                      ]}
                      onPointClick={(payload) => goToDated(payload?.filter)}
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
                    Attendance rate by department, day-state composition, and
                    hardware-scan vs app/remote channel mix, this period.
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
              {/* DATA QUALITY & RECONCILIATION -- new 2026-09-25 chart
                  restructuring pass. Pairs with the Needs Reconciliation/Data
                  Quality KPI tiles, which previously had no supporting chart
                  at all -- a documented gap (RPC-REFERENCE.md) closed here.
                  ACTIONABLE family throughout: Current Backlog by default,
                  matching those two tiles' own window exactly. */}
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
                    <WarningOctagonIcon size={24} />
                    <h2 className="textL textBold">
                      Data Quality & Reconciliation
                    </h2>
                  </div>
                  <p className="textXS textLight">
                    What's driving the Needs Reconciliation and Data Quality
                    backlog right now, and who to follow up with.
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
                    subtitle={`By Absent Days, ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    // calendarType: "ordinary" mirrors topAbsenteeismData's own
                    // `and not is_weekend` guard in
                    // get_attendance_dashboard_rpc.sql. Without it this "View
                    // All" returned every unworked weekend too (an unworked
                    // Saturday reads day_state = 'absent'), so the list showed
                    // roughly twice the days the chart beside it had just
                    // plotted.
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
              {/* HR2000 leave ledger integration -- leave calculated and
                  shown alongside every other Attendance KPI/chart, filtered
                  by the same period/department/employee filters above, so
                  HR can reconcile leave against attendance/overtime for a
                  payroll cycle without leaving this page. Top Leave Days by
                  Employee/Department added 2026-09-25 per HR's own ask --
                  see leaveEmployee_rows' own comment in the RPC for the
                  work-related-leave-classification caveat both leaderboards
                  inherit. */}
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
                    <CalendarXIcon size={24} />
                    <h2 className="textL textBold">Leave</h2>
                  </div>
                  <p className="textXS textLight">
                    Leave days by type, and who/which department is taking
                    the most, this period.
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
