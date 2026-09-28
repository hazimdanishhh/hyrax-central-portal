import { useRef } from "react";
import {
  ChartBarHorizontalIcon,
  ChartPieSliceIcon,
  GaugeIcon,
} from "@phosphor-icons/react";
import { useResolvedPath } from "react-router";

import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  YELLOW_COLOR,
  RED_COLOR,
  PURPLE_COLOR,
  EMPLOYMENT_TYPE_COLORS,
  GENDER_COLORS,
} from "../../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import ExportActions from "../../../../../components/exportActions/ExportActions";
import useDashboardQuery from "../../../../../hooks/useDashboardQuery";
import { fetchEmployeesDashboard } from "../../../../../features/hr/employees/private/api/fetchEmployeesDashboard";
import { useEmployeesMetadata } from "../../../../../features/hr/employees/private/hooks/useEmployeesMetadata";
import { getFilterConfig } from "./config/filterConfig";
import { getEmployeesOverviewConfig } from "./overviewConfig";
import FiscalYearFilterBar from "../../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import { useLifecycleCasesOverview } from "../../../../../features/employeeLifecycle/private/hooks/useLifecycleCasesOverview";
import buildFilterUrl from "@/functions/convertFilter";

export default function EmployeeOverview() {
  const dashboardRef = useRef(null);
  // Chart clicks open in a new tab via window.open, which needs an
  // already-resolved absolute path -- see Attendance Overview's own comment
  // for the full "../list resolved to the wrong parent" bug this avoids.
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
    queryKey: "employees_dashboard",
    queryFn: fetchEmployeesDashboard,
  });

  // Only `departments` is needed here (for the filter dropdown) -- this hook
  // also fetches nationalities/employment types/etc. for Employee
  // Management's edit form, but it's already cached (staleTime 10min) by
  // the time HR staff navigate between List and Overview, so reusing it
  // beats adding a second, narrower metadata fetch just for this one field.
  const {
    departments,
    workLocations,
    isLoading: metadataLoading,
    error: metadataError,
  } = useEmployeesMetadata();

  const filterConfig = getFilterConfig({ departments, workLocations });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError || metadataError;

  // Composed at the page level rather than folded into the existing
  // get_hr_employees_dashboard RPC/fetchEmployeesDashboard -- a second,
  // independent client-side query (mirroring the IT overview's own
  // composition of useITAssetsOverview + this same hook), not a change to
  // that delicate, already-large RPC. See
  // docs/EMPLOYEE-LIFECYCLE-CHECKLIST-ARCHITECTURE.md.
  const { kpis: onboardingKpis } = useLifecycleCasesOverview("ONBOARDING");
  const { kpis: offboardingKpis } = useLifecycleCasesOverview("OFFBOARDING");

  const kpis = {
    ...(dashboard?.kpis ?? {}),
    openOnboardingCasesCount: onboardingKpis.openCount,
    openOffboardingCasesCount: offboardingKpis.openCount,
    stuckLifecycleCasesCount: onboardingKpis.stuckCount + offboardingKpis.stuckCount,
  };

  // Whether a date range is actually selected -- same REGULAR/SNAPSHOT
  // subtitle vocabulary overviewConfig.js's own tiles use (see that file's
  // periodLabel comment for the SNAPSHOT-family rationale).
  const isPeriodFiltered =
    Boolean(filters.startDate) && Boolean(filters.endDate);
  const periodLabel = isPeriodFiltered ? "This Period" : "This Month";

  // Same baseFilter shape Attendance Overview's own chart links build --
  // duplicated here (rather than exported) since these are plain JSX props,
  // not part of the tile config array itself.
  const chartBaseFilter = {
    ...(filters.department && { department: filters.department }),
    ...(filters.workLocation && { workLocation: filters.workLocation }),
  };

  // Chart-element drill-through (2026-09-28, mirrors
  // get_attendance_dashboard_rpc.sql's convention exactly). Every clickable
  // chart datum already carries its own RPC-computed `filter` object
  // (statusBucket + the specific dimension, for SNAPSHOT charts; statusBucket
  // + the departure-date window + reason, for Termination Reasons) -- this
  // just merges in the page's own department/work-location selection and
  // returns a URL. `filter` is null for a bucket with no sensible single
  // filter (e.g. "Unassigned") -- those clicks are a no-op.
  const goTo = (filter) =>
    filter ? `${listPath}${buildFilterUrl({ ...chartBaseFilter, ...filter })}` : null;

  const departmentData = dashboard?.departmentData ?? [];
  const employmentTypeData = dashboard?.employmentTypeData ?? [];
  const genderData = dashboard?.genderData ?? [];
  const nationalityData = dashboard?.nationalityData ?? [];
  const ageDistributionData = dashboard?.ageDistributionData ?? [];

  // No per-point `filter` -- deliberately, see the RPC's own comment on
  // headcountTrendData: there's no verified filter that reconstructs
  // point-in-time roster membership, so this chart stays un-clickable
  // rather than ship a guessed one.
  const headcountTrendData =
    dashboard?.headcountTrendData?.map((d) => ({
      name: d.period,
      Headcount: d.headcount,
    })) ?? [];

  const tenureDistributionData = dashboard?.tenureDistributionData ?? [];
  const overviewItems = getEmployeesOverviewConfig(
    kpis,
    tenureDistributionData,
    ageDistributionData,
    filters,
  );
  const topManagersData = dashboard?.topManagersData ?? [];
  const terminationReasonsData = dashboard?.terminationReasonsData ?? [];

  return (
    <>
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

      {/* FISCAL YEAR FILTER */}
      <FiscalYearFilterBar filters={filters} onFilterChange={setFilters} />

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
          fileName="Employee_Overview_Report"
          reportTitle="Employee Overview"
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
            <NoResult title="Error loading employee overview." />
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
                    <h2 className="textL textBold">Employee KPIs</h2>
                  </div>
                  <p className="textXS textLight">
                    Who's here, who's at risk of leaving, and what HR needs to
                    action next.
                  </p>
                </div>

                <OverviewCards items={overviewItems} />
              </div>
            </div>

            <div className="pdfOverviewSection">
              {/* WORKFORCE COMPOSITION -- SNAPSHOT family throughout: the
                  roster's shape right now, ignores the date filter entirely.
                  Top Managers moved here (2026-09-28) -- span-of-control is
                  an org-structure fact, not a movement metric. */}
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
                    <ChartPieSliceIcon size={24} />
                    <h2 className="textL textBold">Workforce Composition</h2>
                  </div>
                  <p className="textXS textLight">
                    How the active workforce breaks down by department,
                    employment type, gender, nationality, age, tenure, and
                    span of control -- right now.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Departments"
                    subtitle="Active Headcount, Current"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ statusBucket: "active" }}
                  >
                    <HorizontalBarChartRenderer
                      data={departmentData}
                      colorMap={GREEN_COLOR}
                      onBarClick={(entry) => goTo(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Employment Type"
                    subtitle="Active Headcount (Share), Current"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ statusBucket: "active" }}
                  >
                    <PieChartRenderer
                      data={employmentTypeData}
                      mode="semantic"
                      colorMap={EMPLOYMENT_TYPE_COLORS}
                      onSliceClick={(entry) => goTo(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Gender Distribution"
                    subtitle="Active Headcount (Share), Current"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ statusBucket: "active" }}
                  >
                    <PieChartRenderer
                      data={genderData}
                      mode="semantic"
                      colorMap={GENDER_COLORS}
                      onSliceClick={(entry) => goTo(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Nationality"
                    subtitle="Active Headcount, Current"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ statusBucket: "active" }}
                  >
                    <HorizontalBarChartRenderer
                      data={nationalityData}
                      colorMap={BLUE_COLOR}
                      onBarClick={(entry) => goTo(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Age Distribution"
                    subtitle="Active Employees, by Age Band, Current"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ statusBucket: "active" }}
                  >
                    <BarChartRenderer
                      data={ageDistributionData}
                      colorMap={PURPLE_COLOR}
                      onBarClick={(entry) => goTo(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Tenure Distribution"
                    subtitle="Active Employees, by Years of Service, Current"
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{ statusBucket: "active" }}
                  >
                    <BarChartRenderer
                      data={tenureDistributionData}
                      colorMap={YELLOW_COLOR}
                      onBarClick={(entry) => goTo(entry.filter)}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Top Managers"
                    subtitle="By Direct Report Count, Current"
                    style="cardGapSmall"
                  >
                    <BarChartRenderer
                      data={topManagersData}
                      colorMap={BLUE_COLOR}
                      onBarClick={(entry) => goTo(entry.filter)}
                    />
                  </ChartCard>
                </CardLayout>
              </div>
            </div>

            <div className="pdfOverviewSection">
              {/* MOVEMENT & RETENTION */}
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
                    <ChartBarHorizontalIcon size={24} />
                    <h2 className="textL textBold">Movement &amp; Retention</h2>
                  </div>
                  <p className="textXS textLight">
                    Headcount trend over time, and why people have left this
                    period.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Headcount Trend"
                    subtitle="Monthly Active Headcount, All-Time — Not Affected by the Date Filter"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={headcountTrendData}
                      lines={[{ dataKey: "Headcount", color: BLUE_COLOR }]}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Termination Reasons"
                    subtitle={`Departures, ${periodLabel}`}
                    style="cardGapSmall"
                    viewAllTo="../list"
                    viewAllFilter={{
                      ...chartBaseFilter,
                      statusBucket: "terminated",
                    }}
                  >
                    <HorizontalBarChartRenderer
                      data={terminationReasonsData}
                      colorMap={RED_COLOR}
                      onBarClick={(entry) => goTo(entry.filter)}
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
