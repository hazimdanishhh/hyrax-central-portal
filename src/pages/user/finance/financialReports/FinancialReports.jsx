import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  GaugeIcon,
  ChartBarHorizontalIcon,
  RankingIcon,
} from "@phosphor-icons/react";

import CardLayout from "../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../components/chartCard/HorizontalMultiBarRenderer";
import LineChartRenderer from "../../../../components/chartCard/LineChartRenderer";
import PieChartRenderer from "../../../../components/chartCard/PieChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
} from "../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import ExportActions from "../../../../components/exportActions/ExportActions";
import AISummary from "../../../../components/aiSummary/AISummary";
import GenerateAiButton from "../../../../components/aiSummary/generateAIButton/GenerateAIButton";
import useDashboardQuery from "../../../../hooks/useDashboardQuery";
import { fetchFinanceDashboard } from "../../../../features/finance/reports/private/api/fetchFinanceDashboard";
import { useFinanceMetadata } from "../../../../features/finance/reports/private/hooks/useFinanceMetadata";
import { getFilterConfig } from "./config/filterConfig";
import { getFinanceOverviewConfig } from "./config/overviewConfig";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";

export default function FinancialReports() {
  const { darkMode } = useTheme();
  const queryClient = useQueryClient();
  const dashboardRef = useRef(null);

  const handleAiComplete = () => {
    queryClient.invalidateQueries(["ai_summary", "finance"]);
  };

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
    queryKey: "finance_dashboard",
    queryFn: fetchFinanceDashboard,
  });

  const {
    salesReps,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useFinanceMetadata();

  const filterConfig = getFilterConfig({ salesReps });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching || metadataFetching;
  const isError = dashboardError || metadataError;

  const kpis = dashboard?.kpis ?? {};
  const overviewItems = getFinanceOverviewConfig(kpis);

  // AR aging / outstanding balances are always "as of today" -- not bounded
  // by the date filter, so bucket_order from the RPC drives display order.
  const arAgingData =
    dashboard?.arAgingData?.map((d) => ({
      name: d.bucket,
      value: d.outstanding_myr,
    })) ?? [];

  const revenueTrendData =
    dashboard?.revenueTrendData?.map((d) => ({
      name: d.period,
      "Invoiced (RM)": d.invoiced_myr,
      "Collected (RM)": d.collected_myr,
    })) ?? [];

  const topOverdueCustomersData =
    dashboard?.topOverdueCustomersData?.map((d) => ({
      name: d.customer_name,
      value: d.outstanding_myr,
    })) ?? [];

  // HorizontalMultiBarRenderer's Y-axis reads dataKey="name" for the category label.
  const salesRepRevenueData =
    dashboard?.salesRepRevenueData?.map((d) => ({
      name: d.sales_rep_name,
      revenue_myr: d.revenue_myr,
      gross_profit_myr: d.gross_profit_myr,
    })) ?? [];

  const topCustomersByRevenueData =
    dashboard?.topCustomersByRevenueData?.map((d) => ({
      name: d.customer_name,
      value: d.revenue_myr,
    })) ?? [];

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <CardWrapper>
            {/* SEARCH AND FILTER BAR */}
            <SearchFilterBar
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              enableDateRange
              disableSearch={true}
              isLoading={isLoading}
              isError={isError}
            />

            {/* AI BUTTON + EXPORT */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.8rem",
              }}
            >
              {/* <GenerateAiButton
                type="finance"
                filters={filters}
                onComplete={handleAiComplete}
              /> */}
              <ExportActions
                targetRef={dashboardRef}
                fileName="Finance_Dashboard_Report"
                reportTitle="Finance Dashboard"
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
                  <NoResult title="Error loading data." />
                </CardLayout>
              ) : (
                <>
                  <div className="pdfOverviewSection">
                    <AISummary type="finance" filters={filters} />

                    {/* TIER 1: THE HIGH-LEVEL SUMMARY */}
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
                          <h2 className="textL textBold">Finance KPIs</h2>
                        </div>
                        <p className="textXS textLight">
                          Live revenue, collections, and AR health.
                        </p>
                      </div>

                      <OverviewCards items={overviewItems} />
                    </div>
                  </div>

                  <div className="pdfOverviewSection">
                    {/* TIER 2: AR AGING & COLLECTIONS */}
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
                          <h2 className="textL textBold">
                            AR Aging &amp; Collections
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Outstanding balances and revenue vs. cash collected
                          over time.
                        </p>
                      </div>

                      <CardLayout style="cardLayout3">
                        <ChartCard
                          title="AR Aging"
                          subtitle="As of today — not affected by date filter"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={arAgingData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Top Overdue Customers"
                          subtitle="Outstanding AR (RM)"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={topOverdueCustomersData}
                            colorMap="#ef4444"
                          />
                        </ChartCard>

                        <ChartCard
                          title="Collection Rate"
                          subtitle="Collected vs Outstanding (This Period)"
                          style="cardGapSmall"
                        >
                          <PieChartRenderer
                            data={[
                              {
                                name: "Collected",
                                value: kpis.totalCollected || 0,
                              },
                              {
                                name: "Outstanding",
                                value: Math.max(
                                  0,
                                  (kpis.periodInvoicedRevenue || 0) -
                                    (kpis.totalCollected || 0),
                                ),
                              },
                            ]}
                            mode="semantic"
                            colorMap={{
                              Collected: GREEN_COLOR,
                              Outstanding: BLUE_COLOR,
                            }}
                            centerLabel={`${kpis.collectionRatePct || 0}%`}
                            centerSubLabel="Collection Rate"
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>

                    <CardLayout>
                      <ChartCard
                        title="Revenue Trend"
                        subtitle="Invoiced vs Collected (RM)"
                        style="cardGapSmall"
                      >
                        <LineChartRenderer
                          data={revenueTrendData}
                          lines={[
                            { dataKey: "Invoiced (RM)", color: BLUE_COLOR },
                            { dataKey: "Collected (RM)", color: GREEN_COLOR },
                          ]}
                        />
                      </ChartCard>
                    </CardLayout>

                    {/* TIER 3: SALESPERSON HEALTH & TOP CUSTOMERS */}
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
                          <RankingIcon size={24} />
                          <h2 className="textL textBold">
                            Salesperson Health &amp; Top Customers
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Revenue and gross profit by rep, and where our revenue
                          is concentrated.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Salesperson Health"
                          subtitle="Revenue & GP by rep (RM)"
                          style="cardGapSmall"
                        >
                          <HorizontalMultiBarRenderer
                            data={salesRepRevenueData}
                            bars={[
                              {
                                dataKey: "revenue_myr",
                                name: "Revenue",
                                color: BLUE_COLOR,
                              },
                              {
                                dataKey: "gross_profit_myr",
                                name: "Gross Profit",
                                color: GREEN_COLOR,
                              },
                            ]}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Top Customers by Revenue"
                          subtitle="Invoiced (RM)"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={topCustomersByRevenueData}
                            colorMap={BLUE_COLOR}
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
