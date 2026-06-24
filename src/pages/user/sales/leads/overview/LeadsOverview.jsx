import { useRef, useState } from "react";
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
import HorizontalBarChartRenderer from "../../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalDualBarRenderer from "../../../../../components/chartCard/HorizontalDualBarRenderer";
import HorizontalMultiBarRenderer from "../../../../../components/chartCard/HorizontalMultiBarRenderer";
import Button from "../../../../../components/buttons/button/Button";
import { getChartConfig } from "./config/chartConfig";
import { fetchSalesTargets } from "../../../../../features/sales/leads/private/api/fetchSalesTargets";

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

  // FETCH PRORATED SALES TARGETS
  const {
    data: targetData,
    isLoading: targetLoading,
    isFetching: targetFetching,
    error: targetError,
  } = useDashboardQuery({
    queryKey: "sales_targets",
    queryFn: fetchSalesTargets,
  });

  console.log(dashboard);

  // ==============
  // LEADERBOARD LENS STATE
  // ==============
  // "productivity" | "accuracy" | "execution"
  const [leaderboardView, setLeaderboardView] = useState("productivity");

  const chartConfig = getChartConfig(leaderboardView);
  // ==============

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
  //     value: d.won_revenue, // Changed from d.count
  //   })) ?? [];

  // const sourceData =
  //   dashboard?.sourceData?.map((d) => ({
  //     name: d.name,
  //     value: d.won_revenue, // Changed from d.count
  //   })) ?? [];

  // const topClientsData =
  //   dashboard?.topClientsData?.map((d) => ({
  //     name: d.name,
  //     value: d.won_revenue, // Changed from d.count
  //   })) ?? [];

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

  // const productTypeData =
  //   dashboard?.productTypeData?.map((d) => ({
  //     name: d.name,
  //     value: d.won_revenue, // Showing RM value distribution by product
  //   })) ?? [];

  const productTypeData = dashboard?.productTypeData ?? [];
  const leadOwnerData = dashboard?.leadOwnerData ?? [];
  const sourceData = dashboard?.sourceData ?? [];
  const topClientsData = dashboard?.topClientsData ?? [];

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

  const isLoading = dashboardLoading || metadataLoading || targetLoading;
  const isFetching = dashboardFetching || metadataFetching || targetFetching;
  const isError = dashboardError || metadataError || targetError;

  // const overviewItems = getLeadsOverviewConfig(kpis);
  const overviewItems = getLeadsOverviewConfig(kpis, targetData);

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
            {/* TIER 1: THE HIGH-LEVEL SUMMARY */}
            <OverviewCards items={overviewItems} />

            {/* TIER 2: FORWARD-LOOKING FUNNEL (What is coming next?) */}
            <div style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
              <h2 className="textL textBold">Pipeline Health & Funnel</h2>
              <p className="textXS textLight">
                Leading indicators and current pipeline distribution.
              </p>
            </div>

            <CardLayout style="cardLayout2">
              {/* LEAD STAGES */}
              <ChartCard
                title="Lead Stages"
                subtitle="Active Pipeline Drop-off"
                style="cardGapSmall"
              >
                <HorizontalBarChartRenderer
                  data={stageData}
                  colorMap={BLUE_COLOR}
                />
              </ChartCard>

              {/* PIPELINE HEALTH */}
              <ChartCard
                title="Active Pipeline Health"
                subtitle="By Probability (%)"
                style="cardGapSmall"
              >
                <BarChartRenderer
                  data={probabilityHealthData}
                  colorMap={BLUE_COLOR}
                />
              </ChartCard>
            </CardLayout>

            {/* TIER 3: BACKWARD-LOOKING DIAGNOSTICS (Why did it happen?) */}
            <div style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>
              <h2 className="textL textBold">
                Historical Diagnostics & Performance
              </h2>
              <p className="textXS textLight">
                Lagging indicators tracking revenue, speed, accuracy, and
                leaderboards.
              </p>
            </div>

            {/* TREND LINES: Side-by-side for correlation */}
            <CardLayout style="cardLayout3">
              <ChartCard
                title="Pipeline Activity Over Time"
                subtitle="Volume"
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

              <ChartCard
                title="Revenue Trend Over Time"
                subtitle="Actual RM"
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

              {/* REVENUE LOST (Static - Always shows reasons) */}
              <ChartCard
                title="Revenue Lost"
                subtitle="By Reason"
                style="cardGapSmall"
              >
                <HorizontalBarChartRenderer
                  data={lossReasonData}
                  colorMap="#ef4444"
                />
              </ChartCard>
            </CardLayout>

            {/* LENS TOGGLE UI */}
            <div
              style={{
                marginTop: "2.5rem",
                marginBottom: "1rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <h3 className="textL textBold">Executive Leaderboards</h3>
                <p className="textXS textLight">
                  Select a lens to analyze rep, product, and client performance.
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "center",
                }}
                className="pageTabContainer"
              >
                <Button
                  onClick={() => setLeaderboardView("productivity")}
                  name="Productivity (Input/Output)"
                  style={
                    leaderboardView === "productivity"
                      ? "textXS button buttonType5 active"
                      : "textXS button buttonType5"
                  }
                  className="textXXS"
                />
                <Button
                  onClick={() => setLeaderboardView("accuracy")}
                  name="Accuracy (Forecast/Actual)"
                  style={
                    leaderboardView === "accuracy"
                      ? "textXS button buttonType5 active"
                      : "textXS button buttonType5"
                  }
                  className="textXXS"
                />
                <Button
                  onClick={() => setLeaderboardView("execution")}
                  name="Execution (Won/Lost)"
                  style={
                    leaderboardView === "execution"
                      ? "textXS button buttonType5 active"
                      : "textXS button buttonType5"
                  }
                  className="textXXS"
                />
              </div>
            </div>

            {/* LEADERBOARDS: 2-column grid dynamically controlled by the toggle */}
            <CardLayout style="cardLayout2">
              {/* PRODUCT TYPE */}
              {!filters?.productType && (
                <ChartCard
                  title="Product Performance"
                  subtitle={chartConfig.subtitle}
                  style="cardGapSmall"
                >
                  <HorizontalMultiBarRenderer
                    data={productTypeData}
                    bars={chartConfig.bars}
                  />
                </ChartCard>
              )}

              {/* TOP LEAD OWNERS */}
              {!filters?.owner && (
                <ChartCard
                  title="Top Lead Owners"
                  subtitle={chartConfig.subtitle}
                  style="cardGapSmall"
                >
                  <HorizontalMultiBarRenderer
                    data={leadOwnerData}
                    bars={chartConfig.bars}
                  />
                </ChartCard>
              )}

              {/* TOP LEAD SOURCES */}
              {!filters?.leadSourceType && (
                <ChartCard
                  title="Top Lead Sources"
                  subtitle={chartConfig.subtitle}
                  style="cardGapSmall"
                >
                  <HorizontalMultiBarRenderer
                    data={sourceData}
                    bars={chartConfig.bars}
                  />
                </ChartCard>
              )}

              {/* TOP CLIENTS */}
              {!filters?.client && (
                <ChartCard
                  title="Top Clients"
                  subtitle={chartConfig.subtitle}
                  style="cardGapSmall"
                >
                  <HorizontalMultiBarRenderer
                    data={topClientsData}
                    bars={chartConfig.bars}
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
