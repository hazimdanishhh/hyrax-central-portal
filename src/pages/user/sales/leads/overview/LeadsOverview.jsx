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
  PRODUCT_TYPE_COLORS,
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
import { getLeadsOverviewConfig } from "./config/overviewConfig";
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

  console.log(dashboard);

  const kpis = dashboard?.kpis ?? {};

  // Map to 'value' based on what you want to chart (volume vs revenue).
  // Using 'count' here for volume, but you could swap it to 'total_value'.
  const stageData =
    dashboard?.stageData?.map((d) => ({
      name: d.name,
      value: d.count,
    })) ?? [];

  const leadOwnerData =
    dashboard?.leadOwnerData?.map((d) => ({
      name: d.name,
      value: d.won_revenue, // Changed from d.count
    })) ?? [];

  const sourceData =
    dashboard?.sourceData?.map((d) => ({
      name: d.name,
      value: d.won_revenue, // Changed from d.count
    })) ?? [];

  const topClientsData =
    dashboard?.topClientsData?.map((d) => ({
      name: d.name,
      value: d.won_revenue, // Changed from d.count
    })) ?? [];

  const trendData =
    dashboard?.trendData?.map((d) => ({
      name: d.period,
      "Leads Generated": d.leads_created,
      "Deals Won": d.deals_won,
      "Deals Lost": d.deals_lost,
      "Pipeline Generated (RM)": d.pipeline_generated, // NEW
      "Revenue Won (RM)": d.revenue_won, // NEW
      "Revenue Lost (RM)": d.revenue_lost, // NEW
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

  const productTypeData =
    dashboard?.productTypeData?.map((d) => ({
      name: d.name,
      value: d.won_revenue, // Showing RM value distribution by product
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

  const formatCurrency = (value) => {
    if (!value && value !== 0) return "RM0";

    if (value >= 1_000_000) {
      return `RM${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (value >= 1_000) {
      return `RM${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    }

    return `RM${value}`;
  };

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
              {/* LEAD STAGES */}
              <ChartCard title="Lead Stages" style="cardGapSmall">
                <PieChartRenderer
                  data={stageData}
                  mode="semantic"
                  colorMap={LEAD_STAGE_COLORS}
                  centerLabel={kpis.activeLeads}
                  centerSubLabel="Active Leads"
                />
              </ChartCard>

              {/* PRODUCT TYPE */}
              {!filters?.productType && (
                <ChartCard
                  title="Won Revenue by Product Type (RM)"
                  style="cardGapSmall"
                >
                  <PieChartRenderer
                    data={productTypeData}
                    mode="semantic"
                    colorMap={PRODUCT_TYPE_COLORS}
                    centerLabel={formatCurrency(kpis.wonRevenue)}
                    centerSubLabel="Total"
                  />
                </ChartCard>
              )}

              {/* PIPELINE HEALTH */}
              <ChartCard
                title="Pipeline Health (Probability)"
                style="cardGapSmall"
              >
                <BarChartRenderer
                  data={probabilityHealthData}
                  colorMap={BLUE_COLOR}
                />
              </ChartCard>

              {/* PIPELINE ACTIVITY */}
              <ChartCard
                title="Pipeline Activity Over Time (Volume)"
                style="cardGapSmall"
              >
                <LineChartRenderer
                  data={trendData}
                  lines={[
                    { dataKey: "Leads Generated", color: BLUE_COLOR },
                    { dataKey: "Deals Won", color: GREEN_COLOR },
                    { dataKey: "Deals Lost", color: "#ef4444" },
                  ]}
                />
              </ChartCard>

              {/* FINANCIAL TREND CHART */}
              <ChartCard
                title="Revenue Trend Over Time (Actual RM)"
                style="cardGapSmall"
              >
                <LineChartRenderer
                  data={trendData}
                  lines={[
                    { dataKey: "Pipeline Generated (RM)", color: BLUE_COLOR },
                    { dataKey: "Revenue Won (RM)", color: GREEN_COLOR },
                    { dataKey: "Revenue Lost (RM)", color: "#ef4444" },
                  ]}
                />
              </ChartCard>

              {/* REVENUE LOST REASON */}
              <ChartCard title="Revenue Lost by Reason" style="cardGapSmall">
                <BarChartRenderer
                  data={lossReasonData}
                  colorMap="#ef4444" // Using red to indicate loss
                  layout="vertical" // Vertical bars are usually better for long text reasons
                />
              </ChartCard>

              {/* TOP LEAD OWNERS */}
              {!filters?.owner && (
                <ChartCard
                  title="Top Lead Owners"
                  subtitle="by Won Revenue (RM)"
                  style="cardGapSmall"
                >
                  <BarChartRenderer
                    data={leadOwnerData}
                    colorMap={BLUE_COLOR}
                  />
                </ChartCard>
              )}

              {!filters?.leadSourceType && (
                <ChartCard
                  title="Lead Sources"
                  subtitle="by Won Revenue (RM)"
                  style="cardGapSmall"
                >
                  <BarChartRenderer data={sourceData} colorMap={YELLOW_COLOR} />
                </ChartCard>
              )}

              {!filters?.client && (
                <ChartCard
                  title="Top Clients"
                  subtitle="by Won Revenue (RM)"
                  style="cardGapSmall"
                >
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
