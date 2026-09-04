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
import VerticalMultiBarRenderer from "../../../../components/chartCard/VerticalMultiBarRenderer";
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
import { compactCurrency } from "../../../../functions/formatNumber";
import { getStatusVariant } from "../../../../functions/statusVariant";
import { useFinanceMetadata } from "../../../../features/finance/reports/private/hooks/useFinanceMetadata";
import { getFilterConfig } from "./config/filterConfig";
import { getFinanceOverviewConfig } from "./config/overviewConfig";
import { useTheme } from "../../../../context/ThemeContext";
import { useAccessControl } from "../../../../context/AccessControlContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { formatDateTime } from "../../../../functions/formatDate";

// Text-only good/bad/neutral coloring for the Cash Flow reconciliation
// card below -- see CashFlow.jsx's identical helper for why this maps
// getStatusVariant's level to a plain color instead of its `variant`
// class string (that string is a compound class meant for a full KPI
// card, not a bare inline <span>).
const LEVEL_COLOR = {
  good: GREEN_COLOR,
  warning: YELLOW_COLOR,
  critical: RED_COLOR,
};
const colorFor = (value, options) =>
  options ? LEVEL_COLOR[getStatusVariant(value, options).level] : undefined;

export default function FinancialReports() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();
  const queryClient = useQueryClient();
  const dashboardRef = useRef(null);

  // finance/invoices, finance/payments, finance/bills, and
  // finance/vendor-payments all share the same FIN-only gate (MGM excluded,
  // see R3 in supabase/access-control/README.md), so one check covers every
  // "View All" link below -- an MGM viewer never sees a dead link to a page
  // they can't open.
  const canAccessFinanceOps = canAccess({ departments: ["FIN"] });
  // cash-flow/balance-sheet/income-statement are a DIFFERENT gate --
  // FIN;MGM manager (FinanceRoutes.jsx), not FIN-only -- reusing
  // canAccessFinanceOps here (fixed 2026-09) hid all 3 chart links from MGM
  // managers even though get_finance_dashboard's own guard already lets them
  // through if they navigate there directly.
  const canAccessFinanceStatements = canAccess({
    departments: ["FIN", "MGM"],
    roles: ["manager"],
  });

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

  // Same AR/AP/Payments filter-subset shape overviewConfig.js builds
  // internally for tile links -- duplicated here since these chart-card
  // "View All" links are plain JSX props, not part of the tile config array.
  // customerCode/salesRepCode scope AR only, vendorCode scopes AP only,
  // statusCode/cancelledOnly (converted to the Y/N convention every
  // transactional list actually uses) are shared across all four.
  const chartCancelledFilter =
    filters?.cancelledOnly !== undefined
      ? { isCancelled: filters.cancelledOnly === "true" ? "Y" : "N" }
      : {};
  const chartArFilter = {
    ...(filters?.customerCode && { customerCode: filters.customerCode }),
    ...(filters?.salesRepCode && { salesRepCode: filters.salesRepCode }),
    ...(filters?.statusCode && { statusCode: filters.statusCode }),
    ...chartCancelledFilter,
  };
  const chartApFilter = {
    ...(filters?.vendorCode && { vendorCode: filters.vendorCode }),
    ...(filters?.statusCode && { statusCode: filters.statusCode }),
    ...chartCancelledFilter,
  };
  const chartPaymentsFilter = {
    ...(filters?.customerCode && { customerCode: filters.customerCode }),
    ...chartCancelledFilter,
  };
  const chartVendorPaymentsFilter = {
    ...(filters?.vendorCode && { vendorCode: filters.vendorCode }),
    ...chartCancelledFilter,
  };
  const chartPeriodFilter = {
    ...(filters?.startDate && { startDate: filters.startDate }),
    ...(filters?.endDate && { endDate: filters.endDate }),
  };

  const overviewItems = getFinanceOverviewConfig(
    kpis,
    filters,
    canAccessFinanceOps,
  );

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
  //
  // "(GL)" appended 2026-07 (source-labeling clarity pass, see
  // DASHBOARD-CONVENTIONS.md): this chart's "Revenue"/"Gross Profit"/"Net
  // Profit" bars are General-Ledger-sourced (gl_period_revenue etc.), while
  // the headline "Revenue Invoiced" tile and "Gross Profit" tile's demoted
  // "Invoice GP" sub-metric are invoice-subledger-sourced -- confirmed
  // different numbers, previously indistinguishable by label alone. Done
  // frontend-only (relabeling here, not in the RPC's JSON keys), so no
  // redeploy is needed for this fix.
  const plBreakdownData = dashboard?.plBreakdownData
    ? Object.entries(dashboard.plBreakdownData).map(([name, value]) => ({
        name: `${name} (GL)`,
        value,
      }))
    : [];

  const balanceSheetSnapshotData = dashboard?.balanceSheetSnapshotData
    ? Object.entries(dashboard.balanceSheetSnapshotData).map(
        ([name, value]) => ({ name: `${name} (GL)`, value }),
      )
    : [];

  // Added 2026-07: monthly Revenue/COGS/OpEx/Net Profit, same period-bound
  // convention as revenueTrendData above (all-time if no range selected).
  // Series tagged "(GL, RM)" (added 2026-07, source-labeling clarity pass) --
  // this trend and revenueTrendData below both plot a monthly "Revenue"-ish
  // line, but this one is General-Ledger-sourced while revenueTrendData's
  // "Invoiced" line is invoice-subledger-sourced -- different numbers.
  const plTrendData =
    dashboard?.plTrendData?.map((d) => ({
      name: d.period,
      "Revenue (GL, RM)": d.revenue_myr,
      "COGS (GL, RM)": d.cogs_myr,
      "OpEx (GL, RM)": d.opex_myr,
      "Net Profit (GL, RM)": d.net_profit_myr,
    })) ?? [];

  // Added 2026-07: top 10 leaf expense accounts by amount, period-bound.
  const opexBreakdownData =
    dashboard?.opexBreakdownData?.map((d) => ({
      name: d.account_name,
      value: d.amount_myr,
    })) ?? [];

  // Added 2026-07: same 4 series as plTrendData, bucketed by fiscal year
  // instead of month -- NOT affected by the date filter (always full
  // history), shows the general growth/decline trajectory regardless of
  // whatever period is currently selected.
  const plYoyTrendData =
    dashboard?.plYoyTrendData?.map((d) => ({
      name: d.period,
      "Revenue (GL, RM)": d.revenue_myr,
      "COGS (GL, RM)": d.cogs_myr,
      "OpEx (GL, RM)": d.opex_myr,
      "Net Profit (GL, RM)": d.net_profit_myr,
    })) ?? [];

  // Cash Flow Statement (Finance Expansion Phase 3, added 2026-08). Both
  // cashFlowStatementData/cashFlowWaterfallData are null when no explicit
  // date range is selected (see get_finance_dashboard_rpc.sql's own comment
  // on why a cash flow statement needs a defined period) -- the chart and
  // reconciliation note below render their own "select a date range" empty
  // state in that case, same pattern as every null-until-filtered figure
  // elsewhere on this page.
  const cashFlowWaterfallData = dashboard?.cashFlowWaterfallData
    ? Object.entries(dashboard.cashFlowWaterfallData).map(([name, value]) => ({
        name,
        value,
      }))
    : [];
  const cashFlowStatement = dashboard?.cashFlowStatementData ?? null;

  // Materiality baseline for the reconciliation checks' "target-band"
  // coloring below -- see CashFlow.jsx's identical calculation for the
  // full reasoning (scales to this period's own cash flow, floored so a
  // quiet period doesn't flag a small absolute residual as "critical").
  const cfMaterialityBase = cashFlowStatement
    ? Math.max(Math.abs(cashFlowStatement.netChangeInCash), 50_000)
    : 0;
  const cfReconciliationBand = {
    direction: "target-band",
    thresholds: {
      target: 0,
      warningTolerance: cfMaterialityBase * 0.15,
      criticalTolerance: cfMaterialityBase * 0.4,
    },
  };

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
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "start",
                        textAlign: "start",
                        gap: "0.8rem",
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
                          subtitle="Revenue through Net Profit (RM), this period — General Ledger postings"
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessFinanceStatements
                              ? "../income-statement"
                              : undefined
                          }
                          viewAllFilter={chartPeriodFilter}
                        >
                          <HorizontalBarChartRenderer
                            data={plBreakdownData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Balance Sheet Snapshot"
                          subtitle="As of today — General Ledger postings, not affected by date filter"
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessFinanceStatements ? "../balance-sheet" : undefined
                          }
                        >
                          <HorizontalBarChartRenderer
                            data={balanceSheetSnapshotData}
                            colorMap={YELLOW_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="P&L Trend (By Period)"
                          subtitle="Revenue, COGS, OpEx & Net Profit by month (RM) — General Ledger postings"
                          style="cardGapSmall"
                        >
                          <LineChartRenderer
                            data={plTrendData}
                            lines={[
                              {
                                dataKey: "Revenue (GL, RM)",
                                color: BLUE_COLOR,
                              },
                              { dataKey: "COGS (GL, RM)", color: RED_COLOR },
                              {
                                dataKey: "OpEx (GL, RM)",
                                color: YELLOW_COLOR,
                              },
                              {
                                dataKey: "Net Profit (GL, RM)",
                                color: GREEN_COLOR,
                              },
                            ]}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Operating Expense Breakdown"
                          subtitle="Top 10 expense accounts this period (RM) — General Ledger postings"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={opexBreakdownData}
                            colorMap={RED_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>

                      <CardLayout style="cardLayout1">
                        <ChartCard
                          title="P&L Trend (YoY)"
                          subtitle="Revenue, COGS, OpEx & Net Profit by month (RM) — General Ledger postings"
                          style="cardGapSmall"
                        >
                          <LineChartRenderer
                            data={plYoyTrendData}
                            lines={[
                              {
                                dataKey: "Revenue (GL, RM)",
                                color: BLUE_COLOR,
                              },
                              { dataKey: "COGS (GL, RM)", color: RED_COLOR },
                              {
                                dataKey: "OpEx (GL, RM)",
                                color: YELLOW_COLOR,
                              },
                              {
                                dataKey: "Net Profit (GL, RM)",
                                color: GREEN_COLOR,
                              },
                            ]}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>
                  </div>

                  {/* TIER 2.5: CASH FLOW (Finance Expansion Phase 3, added 2026-08) */}
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
                          <h2 className="textL textBold">Cash Flow</h2>
                        </div>
                        <p className="textXS textLight">
                          Where cash came from and went this period — select a
                          date range above to see it (a cash flow statement
                          needs a defined period, unlike the other charts on
                          this page).
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Cash Flow Waterfall"
                          subtitle="Operating → Investing → Financing → Net Change in Cash (RM), this period — General Ledger postings, indirect method"
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessFinanceStatements ? "../cash-flow" : undefined
                          }
                          viewAllFilter={chartPeriodFilter}
                        >
                          {cashFlowWaterfallData.length > 0 ? (
                            <HorizontalBarChartRenderer
                              data={cashFlowWaterfallData}
                              colorMap={BLUE_COLOR}
                            />
                          ) : (
                            <p className="textXS textLight textCenter">
                              Select a date range to see the cash flow statement
                              for that period.
                            </p>
                          )}
                        </ChartCard>

                        <ChartCard
                          title="Reconciliation Check"
                          subtitle="Computed net change in cash vs. two independent sources — a small residual is expected (FX effect), not necessarily an error"
                          style="cardGapSmall"
                        >
                          {cashFlowStatement ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.6rem",
                                padding: "0.5rem 0",
                              }}
                            >
                              <div className="textXS">
                                <span className="textLight">
                                  Net Change in Cash (computed):{" "}
                                </span>
                                <span
                                  className="textBold"
                                  style={{
                                    color: colorFor(
                                      cashFlowStatement.netChangeInCash,
                                      { direction: "sign-good" },
                                    ),
                                  }}
                                >
                                  {compactCurrency(
                                    cashFlowStatement.netChangeInCash,
                                  )}
                                </span>
                              </div>
                              <div className="textXS">
                                <span className="textLight">
                                  Effect of exchange rate changes (vs. G/L cash
                                  balance):{" "}
                                </span>
                                <span
                                  className="textBold"
                                  style={{
                                    color: colorFor(
                                      cashFlowStatement.reconciliationDeltaVsGl,
                                      cfReconciliationBand,
                                    ),
                                  }}
                                >
                                  {compactCurrency(
                                    cashFlowStatement.reconciliationDeltaVsGl,
                                  )}
                                </span>
                              </div>
                              <div className="textXS">
                                <span className="textLight">
                                  Effect of exchange rate changes (vs. bank
                                  account movements, OBNK):{" "}
                                </span>
                                <span
                                  className="textBold"
                                  style={{
                                    color: colorFor(
                                      cashFlowStatement.reconciliationDeltaVsBank,
                                      cfReconciliationBand,
                                    ),
                                  }}
                                >
                                  {compactCurrency(
                                    cashFlowStatement.reconciliationDeltaVsBank,
                                  )}
                                </span>
                              </div>
                              <p className="textXXXS textLight">
                                Hyrax holds foreign-currency cash and loan
                                accounts (USD/LKR) that SAP revalues at
                                period-end — a real, non-cash effect on the
                                reported balance, the same "Effect of exchange
                                rate changes on cash" line a standard cash flow
                                statement carries. These two figures should be
                                close to each other and roughly the size of
                                plausible FX movement for the period — if they
                                diverge sharply from each other, or dwarf that,
                                that's still the signal to revisit account
                                classification — see
                                get_finance_dashboard_rpc.sql's Cash Flow
                                Statement comments.
                              </p>
                            </div>
                          ) : (
                            <p className="textXS textLight textCenter">
                              Select a date range to see the reconciliation
                              check for that period.
                            </p>
                          )}
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
                          viewAllTo={
                            canAccessFinanceOps ? "../invoices" : undefined
                          }
                          viewAllFilter={{ ...chartArFilter, statusCode: "O" }}
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
                          viewAllTo={
                            canAccessFinanceOps ? "../invoices" : undefined
                          }
                          viewAllFilter={{
                            ...chartArFilter,
                            statusCode: "O",
                            overdueOnly: "true",
                          }}
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
                          subtitle="Invoiced vs Collected (RM) — gross of returns/credit memos, not yet netted. Invoice-based; see P&L Trend for General Ledger figures"
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
                          viewAllTo={
                            canAccessFinanceOps ? "../payments" : undefined
                          }
                          viewAllFilter={{
                            ...chartPaymentsFilter,
                            unallocatedOnly: "true",
                          }}
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
                          viewAllTo={
                            canAccessFinanceOps ? "../bills" : undefined
                          }
                          viewAllFilter={{ ...chartApFilter, statusCode: "O" }}
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
                          viewAllTo={
                            canAccessFinanceOps ? "../bills" : undefined
                          }
                          viewAllFilter={{
                            ...chartApFilter,
                            statusCode: "O",
                            overdueOnly: "true",
                          }}
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
                          viewAllTo={
                            canAccessFinanceOps ? "../bills" : undefined
                          }
                          viewAllFilter={{
                            ...chartApFilter,
                            ...chartPeriodFilter,
                          }}
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
                          viewAllTo={
                            canAccessFinanceOps
                              ? "../vendor-payments"
                              : undefined
                          }
                          viewAllFilter={{
                            ...chartVendorPaymentsFilter,
                            unallocatedOnly: "true",
                          }}
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
                          rep, and where our revenue is concentrated --
                          SAP-recognized (sap_invoices), distinct from the
                          CRM's self-reported "Pipeline Attainment" scorecard
                          on the Sales Leads Overview page for the same reps.
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
                                // Relabeled 2026-07 (Finance Reports redesign,
                                // Pass 1): the headline Gross Profit tile now
                                // shows the GL-based figure -- this legend
                                // must say plainly that THIS bar is still the
                                // invoice-based (SAP GrosProfit) figure, so
                                // the two don't read as the same number.
                                name: "Gross Profit (Invoice-Based)",
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
                          viewAllTo={
                            canAccessFinanceOps ? "../invoices" : undefined
                          }
                          viewAllFilter={{
                            ...chartArFilter,
                            ...chartPeriodFilter,
                          }}
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
