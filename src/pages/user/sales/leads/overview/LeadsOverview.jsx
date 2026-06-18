import CardLayout from "../../../../../components/cardLayout/CardLayout";
import BarChartRenderer from "../../../../../components/chartCard/BarChartRenderer";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../../components/chartCard/PieChartRenderer";
import StackedBarRenderer from "../../../../../components/chartCard/StackedBarRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  LEAD_STAGE_COLORS,
  LEAD_TREND_COLORS,
  LEAD_UTILIZATION_COLORS,
  YELLOW_COLOR,
} from "../../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import OverviewCards from "../../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import { fetchLeadsDashboard } from "../../../../../features/sales/leads/private/api/fetchLeadsDashboard";
import { useLeadsMetadata } from "../../../../../features/sales/leads/private/hooks/useLeadsMetadata";
import useDashboardQuery from "../../../../../hooks/useDashboardQuery";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import { getFilterConfig } from "../list/constants/filterConfig";
import { getLeadsOverviewConfig } from "./overviewConfig";

export default function LeadsOverview() {
  const {
    data: dashboard,
    search,
    filters,
    activeFilters,
    hasActiveFilters,
    setSearch,
    setFilters,
    resetParams,
    isLoading,
    isFetching,
    error,
  } = useDashboardQuery({
    queryKey: "sales_leads",
    queryFn: fetchLeadsDashboard,
  });

  console.log("dashboard", dashboard);

  const kpis = dashboard?.kpis ?? {};

  const stageData = dashboard?.stageData ?? [];

  const leadOwnerData = dashboard?.leadOwnerData ?? [];

  const sourceData = dashboard?.sourceData ?? [];

  const topClientsData = dashboard?.topClientsData ?? [];

  const leadsTrendData = dashboard?.leadsTrendData ?? [];

  const pipelineDistributionData = dashboard?.pipelineDistributionData ?? [];

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

      {isLoading ? (
        <CardLayout style="cardLayoutFlexFull">
          <LoadingIcon />
        </CardLayout>
      ) : (
        <>
          <OverviewCards items={overviewItems} />

          <CardLayout style="cardLayout2">
            <ChartCard title="Lead Stages" style="cardGapSmall">
              <PieChartRenderer
                data={stageData}
                mode="semantic"
                colorMap={LEAD_STAGE_COLORS}
                centerLabel={kpis.activeLeads}
                centerSubLabel="Active Leads"
              />
            </ChartCard>

            {/* <ChartCard title="Lead Trends Over Time" style="cardGapSmall">
              <LineChartRenderer
                data={leadsTrendData}
                lines={[
                  {
                    dataKey: "Total",
                    color: LEAD_TREND_COLORS.Total,
                  },
                  {
                    dataKey: "Won",
                    color: LEAD_TREND_COLORS.Won,
                  },
                  {
                    dataKey: "Lost",
                    color: LEAD_TREND_COLORS.Lost,
                  },
                  {
                    dataKey: "Active",
                    color: LEAD_TREND_COLORS.Active,
                  },
                ]}
              />
            </ChartCard> */}

            {/* <ChartCard title="Pipeline Distribution" style="cardGapSmall">
              <StackedBarRenderer
                data={pipelineDistributionData}
                colorMap={LEAD_UTILIZATION_COLORS}
              />
            </ChartCard> */}

            <ChartCard title="Top Lead Owners" style="cardGapSmall">
              <BarChartRenderer data={leadOwnerData} colorMap={BLUE_COLOR} />
            </ChartCard>

            <ChartCard title="Lead Sources" style="cardGapSmall">
              <BarChartRenderer data={sourceData} colorMap={YELLOW_COLOR} />
            </ChartCard>

            <ChartCard title="Top Clients" style="cardGapSmall">
              <BarChartRenderer data={topClientsData} colorMap={GREEN_COLOR} />
            </ChartCard>

            {/* <ChartCard title="Lead Status Breakdown" style="cardGapSmall">
              <PieChartRenderer
                data={statusBreakdownData}
                mode="semantic"
                colorMap={LEAD_STATUS_COLORS}
              />
            </ChartCard> */}
          </CardLayout>
        </>
      )}
    </>
  );
}
