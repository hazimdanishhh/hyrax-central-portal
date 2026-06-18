import { useRef } from "react";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  LEAD_STAGE_COLORS,
  LEAD_TREND_COLORS,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { fetchLeadsDashboard } from "../../../../../features/sales/leads/private/api/fetchLeadsDashboard";
import { useLeadsMetadata } from "../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import useDashboardQuery from "../../../../../hooks/useDashboardQuery";
import { getFilterConfig } from "./config/filterConfig";
import { getLeadsOverviewConfig } from "./overviewConfig";
import ExportActions from "../../../../../components/exportActions/ExportActions";
import ExportData from "../../../../../components/exportActions/ExportData";
import ExportFullReport from "../../../../../components/exportActions/ExportFullReport";

export default function LeadsOverview() {
  const dashboardRef = useRef(null);

  const {
    data: dashboard,
    search,
    filters,
    activeFilters,
    hasActiveFilters,
    setSearch,
    setFilters,
    resetParams,
    isLoading: dashboardLoading,
    isFetching: dashboardFetching,
    error: dashboardError,
  } = useDashboardQuery({
    queryKey: "sales_leads",
    queryFn: fetchLeadsDashboard,
  });

  const kpis = dashboard?.kpis ?? {};

  // Map to 'value' based on what you want to chart (volume vs revenue).
  // Using 'count' here for volume, but you could swap it to 'total_value'.
  const stageData =
    dashboard?.stageData?.map((d) => ({
      name: d.name,
      value: d.count,
    })) ?? [];

  // const leadOwnerData =
  //   dashboard?.leadOwnerData?.map((d) => ({
  //     name: d.name,
  //     value: d.count,
  //   })) ?? [];

  const leadOwnerData =
    dashboard?.leadOwnerData?.map((d) => ({
      name: d.name,
      value: d.active_and_won_value, // Changed from d.count
    })) ?? [];

  // const sourceData =
  //   dashboard?.sourceData?.map((d) => ({
  //     name: d.name,
  //     value: d.count,
  //   })) ?? [];

  const sourceData =
    dashboard?.sourceData?.map((d) => ({
      name: d.name,
      value: d.won_revenue, // Changed from d.count
    })) ?? [];

  // const topClientsData =
  //   dashboard?.topClientsData?.map((d) => ({
  //     name: d.name,
  //     value: d.count,
  //   })) ?? [];

  const topClientsData =
    dashboard?.topClientsData?.map((d) => ({
      name: d.name,
      value: d.total_value, // Changed from d.count
    })) ?? [];

  // Map the trend data to use clean labels for the chart tooltips and X-axis
  // const trendData =
  //   dashboard?.trendData?.map((d) => ({
  //     name: d.period,
  //     "Leads Created": d.leads_created,
  //     "Pipeline Generated ($)": d.pipeline_generated,
  //     "Deals Won": d.deals_won,
  //     "Revenue Won ($)": d.revenue_won,
  //   })) ?? [];

  const trendData =
    dashboard?.trendData?.map((d) => ({
      name: d.period,
      "Leads Generated": d.leads_created,
      "Deals Won": d.deals_won,
      "Deals Lost": d.deals_lost,
    })) ?? [];

  const lossReasonData =
    dashboard?.lossReasonData?.map((d) => ({
      name: d.name,
      value: d.total_lost_value, // Visualizing by revenue lost, not just count
    })) ?? [];

  const probabilityHealthData =
    dashboard?.probabilityHealthData?.map((d) => ({
      name: d.name,
      value: d.total_value, // Visualizing the RM value in each probability bucket
    })) ?? [];

  // ==============
  // METADATA
  // ==============
  const {
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useLeadsMetadata();

  // ==============
  // FILTER CONFIG
  // ==============
  const filterConfig = getFilterConfig({
    owners,
    clients,
    clientContacts,
    leadSourceTypes,
  });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching || metadataFetching;
  const isError = dashboardError || metadataError;

  const overviewItems = getLeadsOverviewConfig(kpis);

  return (
    <>
      {/* SEARCH AND FILTER BAR */}
      <SearchFilterBar
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search leads..."
        enableDateRange
        disableSearch={true}
      />

      {/* EXPORT BUTTON */}
      {!isLoading && !isError && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            marginBottom: "1rem",
          }}
        >
          <ExportData search={search} filters={filters} />
          <ExportFullReport
            targetRef={dashboardRef}
            search={search}
            filters={filters}
            fileName="Sales_Leads_Report"
            reportTitle="Sales Leads Report"
            logoUrl="/logos/logo.png"
            subtitle={`Filters Applied: ${
              filters.startDate && filters.endDate
                ? `${filters.startDate} to ${filters.endDate}`
                : "All Time"
            }`}
          />
        </div>
      )}

      <div
        ref={dashboardRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
          padding: "10px",
          backgroundColor: "inherit",
        }}
      >
        {/* ACTIVE FILTERS */}
        {hasActiveFilters && (
          <ActiveFiltersBar
            search={search}
            setSearch={setSearch}
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
            <NoResult title="Error loading data." />
          </CardLayout>
        ) : (
          <>
            <OverviewCards items={overviewItems} />

            <CardLayout style="cardLayout3">
              <ChartCard title="Lead Stages" style="cardGapSmall">
                <PieChartRenderer
                  data={stageData}
                  mode="semantic"
                  colorMap={LEAD_STAGE_COLORS}
                  centerLabel={kpis.activeLeads}
                  centerSubLabel="Active Leads"
                />
              </ChartCard>

              <ChartCard
                title="Pipeline Health (Probability)"
                style="cardGapSmall"
              >
                <BarChartRenderer
                  data={probabilityHealthData}
                  colorMap={BLUE_COLOR}
                />
              </ChartCard>

              <ChartCard
                title="Pipeline Activity Over Time"
                style="cardGapSmall"
              >
                <LineChartRenderer
                  data={trendData}
                  lines={[
                    {
                      dataKey: "Leads Generated",
                      color: BLUE_COLOR,
                    },
                    {
                      dataKey: "Deals Won",
                      color: GREEN_COLOR,
                    },
                    {
                      dataKey: "Deals Lost",
                      color: LEAD_TREND_COLORS?.Lost || "#ef4444", // Red color for lost
                    },
                  ]}
                />
              </ChartCard>

              <ChartCard title="Revenue Lost by Reason" style="cardGapSmall">
                <BarChartRenderer
                  data={lossReasonData}
                  colorMap="#ef4444" // Using red to indicate loss
                  layout="vertical" // Vertical bars are usually better for long text reasons
                />
              </ChartCard>

              {!filters?.owner && (
                <ChartCard title="Top Lead Owners" style="cardGapSmall">
                  <BarChartRenderer
                    data={leadOwnerData}
                    colorMap={BLUE_COLOR}
                  />
                </ChartCard>
              )}

              <ChartCard title="Lead Sources" style="cardGapSmall">
                <BarChartRenderer data={sourceData} colorMap={YELLOW_COLOR} />
              </ChartCard>

              {!filters?.client && (
                <ChartCard title="Top Clients" style="cardGapSmall">
                  <BarChartRenderer
                    data={topClientsData}
                    colorMap={GREEN_COLOR}
                  />
                </ChartCard>
              )}
            </CardLayout>
          </>
        )}
      </div>
    </>
  );
}
