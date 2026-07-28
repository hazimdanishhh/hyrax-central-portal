import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  GaugeIcon,
  ChartBarHorizontalIcon,
  ChartBarIcon,
  RankingIcon,
  WarningIcon,
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
  YELLOW_COLOR,
  RED_COLOR,
} from "../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
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
import { formatDateTime } from "../../../../functions/formatDate";

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
    dataFreshness,
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
  // Source switched from sap_sales_orders to sap_invoices (+ collected cash) --
  // see docs/DASHBOARD-ROADMAP.md §5: Finance reports on invoiced/collected,
  // not order-booked value (that's Sales Reports' orderBookData/
  // invoiceBudgetScorecardData concern).
  const salesRepRevenueData =
    dashboard?.salesRepRevenueData?.map((d) => ({
      name: d.sales_rep_name,
      revenue_myr: d.revenue_myr,
      gross_profit_myr: d.gross_profit_myr,
      collected_myr: d.collected_myr,
    })) ?? [];

  const topCustomersByRevenueData =
    dashboard?.topCustomersByRevenueData?.map((d) => ({
      name: d.customer_name,
      value: d.revenue_myr,
    })) ?? [];

  // Drill-down for the "Cash Collected"/"Unallocated Payments" KPI tile --
  // who's actually sitting on unapplied cash. Always "as of today".
  const unallocatedPaymentsData =
    dashboard?.unallocatedPaymentsData?.map((d) => ({
      name: d.customer_name,
      value: d.unallocated_amount,
    })) ?? [];

  // Accounts Payable chain (Finance Expansion Phase 1, added 2026-07) --
  // mirrors the AR datasets above, field-for-field, on the payables side.
  const apAgingData =
    dashboard?.apAgingData?.map((d) => ({
      name: d.bucket,
      value: d.outstanding_myr,
    })) ?? [];

  const topOverdueVendorsData =
    dashboard?.topOverdueVendorsData?.map((d) => ({
      name: d.vendor_name,
      value: d.outstanding_myr,
    })) ?? [];

  const topVendorsBySpendData =
    dashboard?.topVendorsBySpendData?.map((d) => ({
      name: d.vendor_name,
      value: d.spend_myr,
    })) ?? [];

  const unallocatedOutgoingPaymentsData =
    dashboard?.unallocatedOutgoingPaymentsData?.map((d) => ({
      name: d.vendor_name,
      value: d.unallocated_amount,
    })) ?? [];

  // General Ledger (Finance Expansion Phase 2, added 2026-07). Both are
  // returned as a single JSON object (not an array of rows, unlike every
  // other chart dataset above) -- Object.entries reshapes each into the
  // {name, value} array HorizontalBarChartRenderer expects.
  const plBreakdownData = dashboard?.plBreakdownData
    ? Object.entries(dashboard.plBreakdownData).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  const balanceSheetSnapshotData = dashboard?.balanceSheetSnapshotData
    ? Object.entries(dashboard.balanceSheetSnapshotData).map(
        ([name, value]) => ({ name, value }),
      )
    : [];

  // Added 2026-07: monthly Revenue/COGS/OpEx/Net Profit, same period-bound
  // convention as revenueTrendData above (all-time if no range selected).
  const plTrendData =
    dashboard?.plTrendData?.map((d) => ({
      name: d.period,
      "Revenue (RM)": d.revenue_myr,
      "COGS (RM)": d.cogs_myr,
      "OpEx (RM)": d.opex_myr,
      "Net Profit (RM)": d.net_profit_myr,
    })) ?? [];

  // Added 2026-07: top 10 leaf expense accounts by amount, period-bound.
  const opexBreakdownData =
    dashboard?.opexBreakdownData?.map((d) => ({
      name: d.account_name,
      value: d.amount_myr,
    })) ?? [];

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ChartBarIcon} current="Financial Reports" />

          <CardWrapper>
            {/* LAST UPDATED BAR */}
            {dataFreshness?.asOf && (
              <p
                className="textXXS textLight"
                style={{ padding: "0 1rem" }}
                title={
                  dataFreshness.hasFailedPipeline
                    ? "One or more data syncs failed — figures may be more stale than this timestamp suggests"
                    : undefined
                }
              >
                <span className="textBold">Last Updated:</span>{" "}
                {formatDateTime(dataFreshness.asOf)}
                {dataFreshness.hasFailedPipeline && (
                  <>
                    <WarningIcon size={12} weight="fill" color="#d76363" /> Sync
                    issue detected
                  </>
                )}
              </p>
            )}

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

            {/* FISCAL YEAR FILTER */}
            <FiscalYearFilterBar
              filters={filters}
              onFilterChange={setFilters}
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
                    {/* <AISummary type="finance" filters={filters} /> */}

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

                  {/* TIER 2: P&L & BALANCE SHEET (Finance Expansion Phase 2, added 2026-07) */}
                  {/* Added 2026-07: monthly trend + expense breakdown --
                          plBreakdownData/balanceSheetSnapshotData above are
                          single-period snapshots; these answer "is
                          profitability improving or declining" and "what's
                          inside Operating Expenses". */}
                  <div className="pdfOverviewSection">
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
                          <h2 className="textL textBold">
                            P&amp;L &amp; Balance Sheet
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Profitability from actual General Ledger postings, and
                          a snapshot of what we own vs. owe.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="P&L Breakdown"
                          subtitle="Revenue through Net Profit (RM), this period"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={plBreakdownData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Balance Sheet Snapshot"
                          subtitle="As of today — not affected by date filter"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={balanceSheetSnapshotData}
                            colorMap={YELLOW_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="P&L Trend"
                          subtitle="Revenue, COGS, OpEx & Net Profit by month (RM)"
                          style="cardGapSmall"
                        >
                          <LineChartRenderer
                            data={plTrendData}
                            lines={[
                              { dataKey: "Revenue (RM)", color: BLUE_COLOR },
                              { dataKey: "COGS (RM)", color: RED_COLOR },
                              { dataKey: "OpEx (RM)", color: YELLOW_COLOR },
                              {
                                dataKey: "Net Profit (RM)",
                                color: GREEN_COLOR,
                              },
                            ]}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Operating Expense Breakdown"
                          subtitle="Top 10 expense accounts this period (RM)"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={opexBreakdownData}
                            colorMap={RED_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>
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

                      <CardLayout style="cardLayout2">
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

                        <ChartCard
                          title="Revenue Trend"
                          subtitle="Invoiced vs Collected (RM) — gross of returns/credit memos, not yet netted"
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

                        <ChartCard
                          title="Unallocated Payments"
                          subtitle="Customers sitting on unapplied cash (RM)"
                          style="cardGapSmall"
                          viewAllTo="../payments"
                          viewAllFilter={{ unallocatedOnly: "true" }}
                        >
                          <HorizontalBarChartRenderer
                            data={unallocatedPaymentsData}
                            colorMap={GREEN_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>

                    {/* TIER 2.5: AP AGING & PAYABLES (Finance Expansion Phase 1, added 2026-07) */}
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
                            AP Aging &amp; Payables
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Outstanding vendor balances and where our payables are
                          concentrated.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="AP Aging"
                          subtitle="As of today — not affected by date filter"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={apAgingData}
                            colorMap="#ef4444"
                          />
                        </ChartCard>

                        <ChartCard
                          title="Top Overdue Vendors"
                          subtitle="Outstanding AP (RM)"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={topOverdueVendorsData}
                            colorMap="#ef4444"
                          />
                        </ChartCard>

                        <ChartCard
                          title="Top Vendors by Spend"
                          subtitle="Billed (RM)"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={topVendorsBySpendData}
                            colorMap={YELLOW_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Unallocated Outgoing Payments"
                          subtitle="Paid but not yet allocated to a bill (RM)"
                          style="cardGapSmall"
                          viewAllTo="../vendor-payments"
                          viewAllFilter={{ unallocatedOnly: "true" }}
                        >
                          <HorizontalBarChartRenderer
                            data={unallocatedOutgoingPaymentsData}
                            colorMap={YELLOW_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>

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
                          Invoiced revenue, gross profit, and cash collected by
                          rep, and where our revenue is concentrated.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Salesperson Health"
                          subtitle="Invoiced Revenue, GP & Collected (RM)"
                          style="cardGapSmall"
                        >
                          <HorizontalMultiBarRenderer
                            data={salesRepRevenueData}
                            bars={[
                              {
                                dataKey: "revenue_myr",
                                name: "Invoiced Revenue",
                                color: BLUE_COLOR,
                              },
                              {
                                dataKey: "gross_profit_myr",
                                name: "Gross Profit",
                                color: GREEN_COLOR,
                              },
                              {
                                dataKey: "collected_myr",
                                name: "Collected",
                                color: YELLOW_COLOR,
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
