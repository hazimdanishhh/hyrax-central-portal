import { useRef } from "react";
import {
  ChartBarHorizontalIcon,
  ChartPieSliceIcon,
  GaugeIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import CardLayout from "../../../../../components/cardLayout/CardLayout";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  YELLOW_COLOR,
  RED_COLOR,
  PURPLE_COLOR,
  EMPLOYMENT_TYPE_COLORS,
  GENDER_COLORS,
  UTILIZATION_COLORS,
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

export default function EmployeeOverview() {
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
    isLoading: metadataLoading,
    error: metadataError,
  } = useEmployeesMetadata();

  const filterConfig = getFilterConfig({ departments });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching;
  const isError = dashboardError || metadataError;

  const kpis = dashboard?.kpis ?? {};

  const departmentData = dashboard?.departmentData ?? [];
  const employmentTypeData = dashboard?.employmentTypeData ?? [];
  const genderData = dashboard?.genderData ?? [];
  const nationalityData = dashboard?.nationalityData ?? [];
  const ageDistributionData = dashboard?.ageDistributionData ?? [];
  const managementCoverageData = dashboard?.managementCoverageData ?? [];

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
              {/* WORKFORCE COMPOSITION */}
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
                    employment type, gender, and nationality.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Departments"
                    subtitle="Active Headcount by Department"
                    style="cardGapSmall"
                  >
                    <BarChartRenderer
                      data={departmentData}
                      colorMap={GREEN_COLOR}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Employment Type"
                    subtitle="Active Headcount (Share)"
                    style="cardGapSmall"
                  >
                    <PieChartRenderer
                      data={employmentTypeData}
                      mode="semantic"
                      colorMap={EMPLOYMENT_TYPE_COLORS}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Gender Distribution"
                    subtitle="Active Headcount (Share)"
                    style="cardGapSmall"
                  >
                    <PieChartRenderer
                      data={genderData}
                      mode="semantic"
                      colorMap={GENDER_COLORS}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Nationality"
                    subtitle="Active Headcount"
                    style="cardGapSmall"
                  >
                    <HorizontalBarChartRenderer
                      data={nationalityData}
                      colorMap={BLUE_COLOR}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Age Distribution"
                    subtitle="Active Employees, by Age Band"
                    style="cardGapSmall"
                  >
                    <BarChartRenderer
                      data={ageDistributionData}
                      colorMap={PURPLE_COLOR}
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
                    Headcount trend, tenure profile, span of control, and why
                    people have left.
                  </p>
                </div>

                <CardLayout style="cardLayout2">
                  <ChartCard
                    title="Headcount Trend"
                    subtitle="Monthly Active Headcount (All-Time if No Period Selected)"
                    style="cardGapSmall"
                  >
                    <LineChartRenderer
                      data={headcountTrendData}
                      lines={[{ dataKey: "Headcount", color: BLUE_COLOR }]}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Tenure Distribution"
                    subtitle="Active Employees, by Years of Service"
                    style="cardGapSmall"
                  >
                    <BarChartRenderer
                      data={tenureDistributionData}
                      colorMap={YELLOW_COLOR}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Top Managers"
                    subtitle="By Direct Report Count (Active)"
                    style="cardGapSmall"
                  >
                    <BarChartRenderer
                      data={topManagersData}
                      colorMap={BLUE_COLOR}
                    />
                  </ChartCard>

                  <ChartCard
                    title="Termination Reasons"
                    subtitle="This Period"
                    style="cardGapSmall"
                  >
                    <HorizontalBarChartRenderer
                      data={terminationReasonsData}
                      colorMap={RED_COLOR}
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
