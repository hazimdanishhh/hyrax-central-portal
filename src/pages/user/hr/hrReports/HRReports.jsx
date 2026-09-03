import { useRef } from "react";
import {
  ChartBarIcon,
  ClockIcon,
  GaugeIcon,
  PathIcon,
  RankingIcon,
  UsersFourIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import ChartCard from "../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../components/chartCard/HorizontalBarChartRenderer";
import LineChartRenderer from "../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../components/chartCard/PieChartRenderer";
import {
  ATTENDANCE_FLAG_COLORS,
  BLUE_COLOR,
  EMPLOYMENT_TYPE_COLORS,
  GREEN_COLOR,
  PURPLE_COLOR,
  RED_COLOR,
  WORK_CHANNEL_COLORS,
  YELLOW_COLOR,
} from "../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import ExportActions from "../../../../components/exportActions/ExportActions";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import { useAccessControl } from "../../../../context/AccessControlContext";
import { fetchHrReportsDashboard } from "../../../../features/hr/reports/private/api/fetchHrReportsDashboard";
import { useEmployeesMetadata } from "../../../../features/hr/employees/private/hooks/useEmployeesMetadata";
import useDashboardQuery from "../../../../hooks/useDashboardQuery";
import { getHrReportsFilterConfig } from "./filterConfig";
import {
  getHrReportsNeedsAttentionConfig,
  getHrReportsOverviewConfig,
} from "./overviewConfig";

// AI Summary plumbing -- not enabled live, matching Sales/Finance Reports'
// current state (Finance has it fully wired but commented out, Sales
// doesn't have it at all). Uncomment both the import and the JSX below
// (export row + top of the loaded-content branch) to activate, following
// the one page in this app where it IS live today (LeadsOverview.jsx).
// import AISummary from "../../../../components/aiSummary/AISummary";
// import GenerateAiButton from "../../../../components/aiSummary/generateAIButton/GenerateAIButton";
// import { useQueryClient } from "@tanstack/react-query";

export default function HRReports() {
  const dashboardRef = useRef(null);
  const { canAccess } = useAccessControl();

  // Every HR List/Overview/Lifecycle target route shares one identical
  // gate (departments: ["HR"], no role restriction) -- confirmed via
  // HRRoutes.jsx's consistent <AccessRoute departments={["HR"]}> pattern
  // across employees/attendance/onboarding/offboarding. One shared flag,
  // same technique Finance Reports uses (canAccessFinanceOps) rather than
  // Sales Reports' per-target variables, since there's no divergence here.
  const canAccessHrOps = canAccess({ departments: ["HR"] });

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
    queryKey: "hr_reports_dashboard",
    queryFn: fetchHrReportsDashboard,
  });

  // Reuses Employee Management's existing metadata hook (already fetches
  // departments, cached 10min) rather than adding a second, narrower fetch
  // just for this one filter dropdown -- same technique Employee Overview
  // itself already uses.
  const {
    departments,
    isLoading: metadataLoading,
    error: metadataError,
  } = useEmployeesMetadata();

  const filterConfig = getHrReportsFilterConfig({ departments });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError || metadataError;

  const kpis = dashboard?.kpis ?? {};
  const overviewItems = getHrReportsOverviewConfig(kpis, canAccessHrOps, filters);
  const needsAttentionItems = getHrReportsNeedsAttentionConfig(
    kpis,
    canAccessHrOps,
    filters,
  );

  const chartToday = new Date().toISOString().slice(0, 10);
  const chartMonthStart = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;
  const chartBaseFilter = {
    ...(filters.department && { department: filters.department }),
  };
  const chartPeriodFilter = {
    startDate: filters.startDate || chartMonthStart,
    endDate: filters.endDate || chartToday,
  };

  const onboardingFunnelData = dashboard?.onboardingFunnelData ?? [];
  const offboardingFunnelData = dashboard?.offboardingFunnelData ?? [];
  const departmentCompositionData = dashboard?.departmentCompositionData ?? [];
  const employmentTypeData = dashboard?.employmentTypeData ?? [];
  const tenureDistributionData = dashboard?.tenureDistributionData ?? [];
  const workChannelMixData = dashboard?.workChannelMixData ?? [];
  const leaveTypeBreakdownData = dashboard?.leaveTypeBreakdownData ?? [];
  const hrFlagBreakdownData = dashboard?.hrFlagBreakdownData ?? [];
  const departmentAttendanceData = dashboard?.departmentAttendanceData ?? [];
  const departmentAttritionData = dashboard?.departmentAttritionData ?? [];
  const topManagersData = dashboard?.topManagersData ?? [];

  const headcountTrendData =
    dashboard?.headcountTrendData?.map((d) => ({
      name: d.period,
      Headcount: d.headcount,
    })) ?? [];

  const hiresVsDeparturesTrendData =
    dashboard?.hiresVsDeparturesTrendData?.map((d) => ({
      name: d.period,
      Hires: d.hires,
      Departures: d.departures,
    })) ?? [];

  const attendanceRateTrendData =
    dashboard?.attendanceRateTrendData?.map((d) => ({
      name: d.period,
      "Attendance Rate": d.roster_count
        ? Math.round((d.present_count / d.roster_count) * 100)
        : 0,
    })) ?? [];

  return (
    <section className="sectionLight">
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ChartBarIcon} current="HR Reports" />

          <CardWrapper>
            {/* SEARCH AND FILTER BAR */}
            <SearchFilterBar
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              enableDateRange
              disableSearch
              isLoading={isLoading}
              isError={isError}
            />

            <FiscalYearFilterBar filters={filters} onFilterChange={setFilters} />

            {/* EXPORT */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem" }}>
              {/* <GenerateAiButton type="hr" filters={filters} onComplete={handleAiComplete} /> */}
              <ExportActions
                targetRef={dashboardRef}
                fileName="HR_Reports_Dashboard"
                reportTitle="HR Reports"
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
              style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
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
                  <NoResult title="Error loading HR reports." />
                </CardLayout>
              ) : (
                <>
                  {/* <AISummary type="hr" filters={filters} /> */}

                  {/* 1. HR KPIs */}
                  <div className="pdfOverviewSection">
                    <div style={{ justifyContent: "start", textAlign: "start" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                          <GaugeIcon size={24} />
                          <h2 className="textL textBold">HR KPIs</h2>
                        </div>
                        <p className="textXS textLight">
                          Headcount, attendance, leave, and the employee lifecycle —
                          the state of the workforce this period.
                        </p>
                      </div>

                      <OverviewCards items={overviewItems} />
                    </div>
                  </div>

                  {/* 2. THE EMPLOYEE JOURNEY */}
                  <div className="pdfOverviewSection">
                    <div style={{ justifyContent: "start", textAlign: "start" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                          <PathIcon size={24} />
                          <h2 className="textL textBold">The Employee Journey</h2>
                        </div>
                        <p className="textXS textLight">
                          From first day to last day — how employees moved through
                          onboarding and offboarding this period.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Onboarding"
                          subtitle="Open, Completed, and Stuck Cases"
                          style="cardGapSmall"
                          viewAllTo={canAccessHrOps ? "/app/hr/onboarding" : undefined}
                        >
                          <HorizontalBarChartRenderer
                            data={onboardingFunnelData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Offboarding"
                          subtitle="Open, Completed, and Stuck Cases"
                          style="cardGapSmall"
                          viewAllTo={canAccessHrOps ? "/app/hr/offboarding" : undefined}
                        >
                          <HorizontalBarChartRenderer
                            data={offboardingFunnelData}
                            colorMap={PURPLE_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>
                  </div>

                  {/* 3. NEEDS ATTENTION */}
                  <div className="pdfOverviewSection">
                    <div style={{ justifyContent: "start", textAlign: "start" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                          <WarningCircleIcon size={24} />
                          <h2 className="textL textBold">Needs Attention</h2>
                        </div>
                        <p className="textXS textLight">
                          Confirmations, contracts, and checklists that need HR or
                          management follow-up.
                        </p>
                      </div>

                      <OverviewCards items={needsAttentionItems} />
                    </div>
                  </div>

                  {/* 4. WORKFORCE COMPOSITION & MOVEMENT */}
                  <div className="pdfOverviewSection">
                    <div style={{ justifyContent: "start", textAlign: "start" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                          <UsersFourIcon size={24} />
                          <h2 className="textL textBold">
                            Workforce Composition &amp; Movement
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Who makes up the workforce, and how it's changing.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Headcount Trend"
                          subtitle="Active Headcount, By Month"
                          style="cardGapSmall"
                        >
                          <LineChartRenderer
                            data={headcountTrendData}
                            lines={[{ dataKey: "Headcount", color: BLUE_COLOR }]}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Hires vs Departures"
                          subtitle="By Month"
                          style="cardGapSmall"
                        >
                          <LineChartRenderer
                            data={hiresVsDeparturesTrendData}
                            lines={[
                              { dataKey: "Hires", color: GREEN_COLOR },
                              { dataKey: "Departures", color: RED_COLOR },
                            ]}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Department Composition"
                          subtitle="Active Headcount"
                          style="cardGapSmall"
                          viewAllTo={canAccessHrOps ? "/app/hr/employees/list" : undefined}
                          viewAllFilter={{ statusBucket: "active", ...chartBaseFilter }}
                        >
                          <HorizontalBarChartRenderer
                            data={departmentCompositionData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Employment Type Mix"
                          subtitle="Active Headcount"
                          style="cardGapSmall"
                        >
                          <PieChartRenderer
                            data={employmentTypeData}
                            mode="semantic"
                            colorMap={EMPLOYMENT_TYPE_COLORS}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Tenure Distribution"
                          subtitle="Active Headcount, Years of Service"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={tenureDistributionData}
                            colorMap={GREEN_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>
                  </div>

                  {/* 5. DAY-TO-DAY: ATTENDANCE & LEAVE */}
                  <div className="pdfOverviewSection">
                    <div style={{ justifyContent: "start", textAlign: "start" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                          <ClockIcon size={24} />
                          <h2 className="textL textBold">Day-to-Day: Attendance &amp; Leave</h2>
                        </div>
                        <p className="textXS textLight">
                          How work actually happens day to day, and how leave is
                          being used.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Attendance Rate Trend"
                          subtitle="Present vs Roster, By Month"
                          style="cardGapSmall"
                        >
                          <LineChartRenderer
                            data={attendanceRateTrendData}
                            lines={[{ dataKey: "Attendance Rate", color: BLUE_COLOR }]}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Work Channel Mix"
                          subtitle="Office (Hardware Scan) vs Remote (App), This Period"
                          style="cardGapSmall"
                        >
                          <PieChartRenderer
                            data={workChannelMixData}
                            mode="semantic"
                            colorMap={WORK_CHANNEL_COLORS}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Leave by Type"
                          subtitle="Total Days, This Period"
                          style="cardGapSmall"
                          viewAllTo={canAccessHrOps ? "/app/hr/attendance/list" : undefined}
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
                          title="Status Breakdown"
                          subtitle="By Record, This Period (Excludes Weekend / Rest Day)"
                          style="cardGapSmall"
                          viewAllTo={canAccessHrOps ? "/app/hr/attendance/list" : undefined}
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
                      </CardLayout>
                    </div>
                  </div>

                  {/* 6. BY DEPARTMENT & MANAGER */}
                  <div className="pdfOverviewSection">
                    <div style={{ justifyContent: "start", textAlign: "start" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                          <RankingIcon size={24} />
                          <h2 className="textL textBold">By Department &amp; Manager</h2>
                        </div>
                        <p className="textXS textLight">
                          Attendance and attrition by department, and who's
                          carrying the largest teams.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Attendance Rate by Department"
                          subtitle="This Period (%)"
                          style="cardGapSmall"
                          viewAllTo={canAccessHrOps ? "/app/hr/attendance/list" : undefined}
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
                          title="Attrition Rate by Department"
                          subtitle="This Period (%), vs Current Active Headcount"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={departmentAttritionData}
                            colorMap={RED_COLOR}
                          />
                        </ChartCard>
                        <ChartCard
                          title="Top Managers by Team Size"
                          subtitle="Active Direct Reports"
                          style="cardGapSmall"
                          viewAllTo={canAccessHrOps ? "/app/hr/employees/list" : undefined}
                        >
                          <HorizontalBarChartRenderer
                            data={topManagersData}
                            colorMap={YELLOW_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
