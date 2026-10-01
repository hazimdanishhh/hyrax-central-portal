import { useRef } from "react";
import {
  GaugeIcon,
  UsersThreeIcon,
  RankingIcon,
  ReceiptIcon,
  ChartPieIcon,
  ChartBarIcon,
  WarningIcon,
  WarningCircleIcon,
  FunnelIcon,
  WalletIcon,
} from "@phosphor-icons/react";

import CardLayout from "../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../components/chartCard/HorizontalMultiBarRenderer";
import VerticalMultiBarRenderer from "../../../../components/chartCard/VerticalMultiBarRenderer";
import LineChartRenderer from "../../../../components/chartCard/LineChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  YELLOW_COLOR,
  PURPLE_COLOR,
} from "../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import ExportActions from "../../../../components/exportActions/ExportActions";
import ScorecardList from "../../../../components/sales/leads/leadsScoreCard/LeadsScoreCard";
import useDashboardQuery from "../../../../hooks/useDashboardQuery";
import { fetchSalesReportsDashboard } from "../../../../features/sales/reports/private/api/fetchSalesReportsDashboard";
import { useSalesReportsMetadata } from "../../../../features/sales/reports/private/hooks/useSalesReportsMetadata";
import { getFilterConfig } from "./config/filterConfig";
import { getSalesReportsOverviewConfig } from "./config/overviewConfig";
import { useTheme } from "../../../../context/ThemeContext";
import { useAccessControl } from "../../../../context/AccessControlContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { formatDateTime } from "../../../../functions/formatDate";

function Reports() {
  const { darkMode } = useTheme();
  const { canAccess } = useAccessControl();
  const dashboardRef = useRef(null);

  // sales/orders requires SAL, no role restriction (MGM excluded; reversed
  // 2026-08 off manager-only, see supabase/access-control/README.md) -- the
  // Sales Order Book tile/chart below only link there for viewers who'd
  // actually get in, so an MGM viewer never sees a dead link to a page they
  // can't open. Every actual viewer of this page is already a SAL/MGM
  // manager (Reports itself is manager-gated), so this flag is always true
  // for them today -- kept computed from the target route's real gate
  // anyway, per this file's own stated convention, not hardcoded true.
  const canAccessOrders = canAccess({
    departments: ["SAL", "MGM"],
  });

  // finance/invoices and finance/payments are FIN;MGM (company-wide, no role
  // restriction -- MGM re-added 2026-09, same reversal as canAccessOrders
  // above), matching Finance's own dashboard's identical link gate
  // (canAccessFinanceOps). Without this, a viewer who can't open those
  // Finance pages clicking Invoice Budget Attainment/Customer Concentration/
  // Payments Collected would hit "Unauthorized."
  const canAccessInvoices = canAccess({ departments: ["FIN", "MGM"] });
  const canAccessPayments = canAccess({ departments: ["FIN", "MGM"] });

  // Needs Attention (added 2026-08, O2C funnel restructure) -- SAL-manager
  // only, not MGM: MGM viewers of this page are the holistic/exec-summary
  // audience, not day-to-day coaches -- see
  // docs/SALES-REPORTS-RESTRUCTURE-PLAN.md Part 4.
  const canSeeNeedsAttention = canAccess({ departments: ["SAL"] });

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
    queryKey: "sales_reports_dashboard",
    queryFn: fetchSalesReportsDashboard,
  });

  const {
    owners,
    dataFreshness,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useSalesReportsMetadata();

  const filterConfig = getFilterConfig({ owners });

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching || metadataFetching;
  const isError = dashboardError || metadataError;

  const kpis = dashboard?.kpis ?? {};
  // Fail-open fix (added 2026-08, see get_sales_reports_dashboard_rpc.sql's
  // guard/resolution block) -- true when a Salesperson filter is active but
  // that employee has no employee_sales_rep_mapping row, so every SAP-side
  // figure on this page is correctly showing zero, not "unfiltered by
  // accident." Surfaced as a note rather than a silent empty page.
  const ownerSapMappingMissing = dashboard?.ownerSapMappingMissing ?? false;
  const invoiceBudgetScorecardData =
    dashboard?.invoiceBudgetScorecardData ?? [];
  // Raw (unmapped) topClientsData -- feeds ONLY the CRM-side "Top Clients"
  // chart below (reshaped further down). No longer shared with the overview
  // config -- the Customer Concentration tile converted to SAP-invoiced
  // revenue 2026-07 (see topInvoicedCustomersRaw below).
  const topClientsRaw = dashboard?.topClientsData ?? [];
  // Raw (unmapped) topInvoicedCustomersData -- fed to the overview config
  // for the Customer Concentration tile AND reshaped below for the new "Top
  // Customers by Invoiced Revenue" chart, so both read the same snapshot
  // rather than two separate maps over dashboard?.topInvoicedCustomersData.
  const topInvoicedCustomersRaw = dashboard?.topInvoicedCustomersData ?? [];
  // Raw (unmapped) topProductsData/revenueByProductGroupData (2026-09-30) --
  // fed to the overview config for the new Product/Product Group
  // Concentration tiles' own drill-through filters, same "raw array shared
  // between the tile config and the chart reshape below" pattern as
  // topInvoicedCustomersRaw above. Chart-shape versions (topProductsData/
  // revenueByProductGroupData) are still derived further down, unchanged.
  const topInvoicedProductsRaw = dashboard?.topProductsData ?? [];
  const productGroupsRaw = dashboard?.revenueByProductGroupData ?? [];
  const overviewItems = getSalesReportsOverviewConfig(
    kpis,
    topInvoicedCustomersRaw,
    topInvoicedProductsRaw,
    productGroupsRaw,
    canAccessOrders,
    canAccessInvoices,
    canAccessPayments,
    filters,
  );

  // Same baseFilterCRM/periodFilter/closedPeriodFilter shape overviewConfig.js
  // builds internally for tile links -- duplicated here since these
  // chart-card "View All" links are plain JSX props, not part of the tile
  // config array itself.
  const chartBaseFilterCRM = {
    ...(filters.owner && { owner: filters.owner }),
  };
  const chartIsPeriodFiltered =
    Boolean(filters.startDate) && Boolean(filters.endDate);
  const chartPeriodFilter = chartIsPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};
  const chartClosedPeriodFilter = chartIsPeriodFiltered
    ? { closedDateFrom: filters.startDate, closedDateTo: filters.endDate }
    : {};
  // Chart-subtitle clarity pass (2026-10-01, see
  // docs/portal/DASHBOARD-CONVENTIONS.md §4c) -- every REGULAR chart's
  // subtitle now discloses its time window in the SAME words the KPI tiles
  // above already use, so a subtitle reads for free once a tile's sublabel
  // has been learned. Mirrors overviewConfig.js's own periodLabel exactly.
  const periodLabel = chartIsPeriodFiltered ? "This Period" : "This Month";
  // For the two trend charts (Realized vs Pipeline, Invoiced/Collected/
  // Budget) that respect the date filter when one is set but default to
  // showing ALL historical months when it isn't -- same "needs width" shape
  // as Employee Overview's own Headcount Trend. Deliberately NOT worded
  // "This Month" when unfiltered (that would be false -- the chart shows many
  // months' worth of data by default, not one), and deliberately NOT claiming
  // "Not Affected by the Date Filter" either (unlike a true FIXED-WINDOW
  // chart, this one DOES narrow once a range is picked).
  const trendSubtitle = chartIsPeriodFiltered
    ? "Monthly, This Period"
    : "Monthly, All-Time";
  // ACTIONABLE family's subtitle vocabulary (2026-10-01, Outstanding by
  // Customer) -- mirrors overviewConfig.js's own actionableLabel exactly:
  // "current backlog" when unfiltered, narrows to "this period" once a range
  // is picked.
  const actionableLabel = chartIsPeriodFiltered
    ? "This Period"
    : "Current Backlog";

  // Reshape to the field names ScorecardList/LeadsScoreCard already expects
  // (it's a generic quota-progress card, not Leads-specific -- see
  // docs/DASHBOARD-ROADMAP.md §1.2). employee_uuid resolves the avatar's
  // "view profile" link; falls back to the raw SAP rep code if this rep's
  // employee_sales_rep_mapping row (auto-created per SAP rep) has no
  // employee_id assigned yet -- see docs/DASHBOARD-ROADMAP.md §1.1.
  const invoiceBudgetScorecard = invoiceBudgetScorecardData.map((r) => ({
    lead_owner_id: r.employee_uuid ?? r.sales_rep_code,
    rep_name: r.rep_name,
    avatar_url: r.avatar_url,
    actual_revenue: r.invoiced_revenue,
    target_revenue: r.budget_revenue,
    attainment_percentage: r.attainment_percentage,
    // PO (sales order) vs Invoice vs Budget variance -- the company's actual
    // sales-side analysis, see docs/DASHBOARD-ROADMAP.md §5.
    order_value_myr: r.order_value_myr,
    po_vs_budget_variance_myr: r.po_vs_budget_variance_myr,
    po_vs_invoice_variance_myr: r.po_vs_invoice_variance_myr,
    // O2C funnel's 4th leg (added 2026-08) -- the RPC already computed these
    // (invoiceBudgetScorecardData.collected_myr etc.), this page just never
    // rendered them despite this section's own subtitle already claiming a
    // "Collected" leg existed. See LeadsScoreCard.jsx's hasCollectedVariance.
    collected_myr: r.collected_myr,
    invoice_vs_collected_variance_myr: r.invoice_vs_collected_variance_myr,
    collection_rate_pct: r.collection_rate_pct,
  }));

  // Needs Attention (added 2026-08) -- a client-side-filtered slice of the
  // same scorecard array above, zero new RPC data. Thresholds mirror ones
  // already used elsewhere on this page (80% budget-attainment warning in
  // overviewConfig.js, 70% collection-rate warning matching Payments
  // Collected's own band) -- documented estimates, not audited Sales
  // targets, same convention as DASHBOARD-CONVENTIONS.md's KPI Card Color
  // rules. The unbilled-backlog check flags a rep whose booked-but-not-yet-
  // invoiced backlog exceeds 30% of what they've booked this period.
  const needsAttentionScorecard = invoiceBudgetScorecard.filter((r) => {
    const belowBudget =
      (r.target_revenue ?? 0) > 0 && (r.attainment_percentage ?? 0) < 80;
    const highUnbilledBacklog =
      (r.order_value_myr ?? 0) > 0 &&
      (r.po_vs_invoice_variance_myr ?? 0) / r.order_value_myr > 0.3;
    const lowCollectionRate =
      (r.actual_revenue ?? 0) > 0 && (r.collection_rate_pct ?? 100) < 70;
    return belowBudget || highUnbilledBacklog || lowCollectionRate;
  });

  // Pipeline vs Target (2026-10-01, replaces realizedVsPipelineData/"Invoice
  // vs Pipeline" -- see the RPC's own comment on pipelineVsTargetData for
  // why: that chart compared two different O2C stages that were never
  // expected to match, a real source of confusion). CRM Forecast 1's own
  // trend -- won revenue vs its monthly quota.
  const pipelineVsTargetData =
    dashboard?.pipelineVsTargetData?.map((d) => ({
      name: d.period,
      "Pipeline (Won)": d.pipeline_revenue_myr,
      Target: d.target_revenue_myr,
    })) ?? [];

  const orderBookData =
    dashboard?.orderBookData?.map((d) => ({
      name: d.name,
      value: d.order_value_myr,
    })) ?? [];

  const grossProfitByRepData =
    dashboard?.grossProfitByRepData?.map((d) => ({
      name: d.name,
      revenue_myr: d.revenue_myr,
      gross_profit_myr: d.gross_profit_myr,
    })) ?? [];

  const productTypeData =
    dashboard?.productTypeData?.map((d) => ({
      name: d.name,
      value: d.won_revenue,
    })) ?? [];

  const sourceData =
    dashboard?.sourceData?.map((d) => ({
      name: d.name,
      value: d.won_revenue,
    })) ?? [];

  const topClientsData = topClientsRaw.map((d) => ({
    name: d.name,
    value: d.won_revenue,
  }));

  // FIXED/EXTENDED 2026-10-01: now a 2-series Invoiced/Collected pair per
  // customer (was Invoiced only) -- so a sales/finance viewer can see, for
  // the biggest invoiced accounts specifically, how much of that revenue has
  // actually been paid. Feeds HorizontalMultiBarRenderer below, not
  // HorizontalBarChartRenderer.
  const topInvoicedCustomersData = topInvoicedCustomersRaw.map((d) => ({
    name: d.customer_name,
    Invoiced: d.revenue_myr,
    Collected: d.collected_myr,
  }));

  // Top Products (added 2026-08) -- the first real "actual sales" product
  // cut on this page, sourced from sap_invoice_lines (billed/invoiced), not
  // the CRM product_type enum productTypeData above uses. See
  // get_sales_reports_dashboard_rpc.sql's base_invoice_lines/topProductsData
  // for the source rationale.
  const topProductsData =
    dashboard?.topProductsData?.map((d) => ({
      name: d.item_name,
      value: d.revenue_myr,
    })) ?? [];

  // Revenue by Product Group (added 2026-09, Item Grouping) -- same
  // base_invoice_lines source as topProductsData above, but aggregated
  // across ALL products per SAP item group (OITB), not just the top 10
  // individual products. See
  // hyrax-data-platform/docs/sap-data-architecture-plans/09-item-grouping-execution-plan.md.
  const revenueByProductGroupData =
    dashboard?.revenueByProductGroupData?.map((d) => ({
      name: d.item_group_name,
      value: d.revenue_myr,
    })) ?? [];

  // Order-to-Cash -- Year over Year (new, 2026-10-01, updated same day to
  // fiscal year) -- FIXED-WINDOW, always the trailing 10 fiscal years
  // (April-March), never affected by the page's date filter. The RPC's own
  // field names already match VerticalMultiBarRenderer's `bars` dataKey shape
  // 1:1, so no reshape beyond the usual `?? []` default.
  const orderToCashYoYData = dashboard?.orderToCashYoYData ?? [];

  // Top Customers by Payments Collected (new, 2026-10-01, Payment-Stage
  // Detail) -- same shape as topInvoicedCustomersData's own Invoiced series,
  // cash actually collected rather than invoiced.
  const topPaymentCustomersData =
    dashboard?.topPaymentCustomersData?.map((d) => ({
      name: d.customer_name,
      value: d.collected_myr,
    })) ?? [];

  // Outstanding by Customer (new, 2026-10-01, Payment-Stage Detail) --
  // ACTIONABLE, not REGULAR -- see the RPC's own outstanding_by_customer
  // comment for why this deliberately uses sap_invoices_with_balance's
  // cumulative outstanding_balance rather than a same-period subtraction.
  const outstandingByCustomerData =
    dashboard?.outstandingByCustomerData?.map((d) => ({
      name: d.customer_name,
      value: d.outstanding_myr,
    })) ?? [];

  // Collection Rate by Rep (new, 2026-10-01, Payment-Stage Detail) -- plots
  // the ratio only; collected_myr/invoiced_myr are available on each row for
  // a future tooltip if needed.
  const collectionRateByRepData =
    dashboard?.collectionRateByRepData?.map((d) => ({
      name: d.name,
      value: d.collection_rate_pct,
    })) ?? [];

  // Invoiced / Collected / Budget (added 2026-07, invoice/budget/collected
  // rebalance) -- monthly, respects the page's own date filter (all-time if
  // unset), unlike the fixed trailing-12-month bookingsVsInvoicedTrendData
  // below. The dept-wide, over-time counterpart to the per-rep
  // invoiceBudgetScorecard above.
  const invoicedVsBudgetTrendData =
    dashboard?.invoicedVsBudgetTrendData?.map((d) => ({
      name: d.period,
      Invoice: d.invoiced_revenue_myr,
      Payment: d.collected_revenue_myr,
      Budget: d.budget_revenue_myr,
    })) ?? [];

  // Pipeline stage funnel (added 2026-07) -- ordered DISCOVERY -> LOST by the
  // RPC's own stage_order, so no client-side sort needed. Charting count
  // (volume); total_value is available on each row if a value-weighted
  // funnel is wanted later.
  // FIXED 2026-10-01: charts total_value (RM), not count -- the RPC's own
  // total_value already uses actual_revenue for WON and expected_revenue for
  // every other stage (Discovery/Sample Test/Proposal/Negotiation/Lost, none
  // of which have a real closed amount yet), so this was a pure reshape fix,
  // no RPC change needed. count is still available on each row if a volume
  // view is wanted later.
  const stageData =
    dashboard?.stageData?.map((d) => ({
      name: d.name,
      value: d.total_value,
    })) ?? [];

  // Bookings vs Invoiced (added 2026-07) -- SAP-only booking-to-billing lag,
  // always trailing 12 months and NOT affected by the page's own date filter
  // (see the RPC comment). Distinct from realizedVsPipelineData above, which
  // is the CRM-vs-SAP comparison.
  const bookingsVsInvoicedTrendData =
    dashboard?.bookingsVsInvoicedTrendData?.map((d) => ({
      name: d.period,
      "Sales Order (Booked)": d.booked_revenue_myr,
      "Invoice (Billed)": d.invoiced_revenue_myr,
    })) ?? [];

  // The O2C Funnel (added 2026-08) -- one bar per funnel stage, all four
  // values already exist in kpis, zero new data beyond the two small
  // additive counts (wonLeadCount/paymentCount) the RPC now also returns.
  // See docs/SALES-REPORTS-RESTRUCTURE-PLAN.md Part 4.
  const o2cFunnelData = [
    { name: "Pipeline (Won) — CRM", value: kpis.pipelineWonRevenue ?? 0 },
    { name: "Sales Order (Booked) — SAP", value: kpis.orderBookValue ?? 0 },
    { name: "Invoice (Billed) — SAP", value: kpis.totalInvoiced ?? 0 },
    { name: "Payment (Collected) — SAP", value: kpis.totalCollected ?? 0 },
  ];

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ChartBarIcon} current="Sales Reports" />

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

            <FiscalYearFilterBar
              filters={filters}
              onFilterChange={setFilters}
            />

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
                fileName="Sales_Dashboard_Report"
                reportTitle="Sales Dashboard"
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
                  {/* Fail-open fix note (added 2026-08) -- see
                      ownerSapMappingMissing above. */}
                  {ownerSapMappingMissing && (
                    <p
                      className="textXXS textLight"
                      style={{ padding: "0 1rem" }}
                    >
                      <WarningCircleIcon
                        size={12}
                        weight="fill"
                        color="#d76363"
                      />{" "}
                      This salesperson has no linked SAP sales rep yet — every
                      SAP-sourced figure below correctly shows zero for them
                      (see Sales Rep Mapping).
                    </p>
                  )}

                  <div className="pdfOverviewSection">
                    {/* SALES KPIs -- one tile per O2C stage (row 1), each
                        stage's own diagnostic (row 2). See
                        docs/SALES-REPORTS-RESTRUCTURE-PLAN.md Part 4. */}
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
                          <h2 className="textL textBold">Sales KPIs</h2>
                        </div>
                        <p className="textXS textLight">
                          Order-to-Cash: Pipeline, orders, invoices, and
                          collections
                        </p>
                      </div>

                      <OverviewCards items={overviewItems} />
                    </div>
                  </div>

                  <div className="pdfOverviewSection">
                    {/* THE ORDER-TO-CASH FUNNEL (new, 2026-08) */}
                    <div
                      style={{
                        justifyContent: "start",
                        textAlign: "start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          marginBottom: "1rem",
                          gap: "0.4rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.8rem",
                          }}
                        >
                          <FunnelIcon size={24} />
                          <h2 className="textL textBold">
                            Order-to-Cash Overview
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          The full funnel, trends over time, and multi-year pace
                          — from pipeline won to cash collected.
                        </p>

                        <CardLayout style="cardLayout2">
                          <ChartCard
                            title="Pipeline → Order → Invoice → Payment (RM)"
                            subtitle={`${periodLabel}`}
                            style="cardGapSmall"
                          >
                            <HorizontalBarChartRenderer
                              data={o2cFunnelData}
                              colorMap={BLUE_COLOR}
                            />
                          </ChartCard>
                          <ChartCard
                            title="Order-to-Cash — Year over Year (RM)"
                            subtitle="Trailing 10 Fiscal Years — Not Affected by the Date Filter"
                            style="cardGapSmall"
                          >
                            <VerticalMultiBarRenderer
                              data={orderToCashYoYData}
                              bars={[
                                {
                                  dataKey: "pipeline_revenue_myr",
                                  name: "Pipeline (Won)",
                                  color: BLUE_COLOR,
                                },
                                {
                                  dataKey: "order_value_myr",
                                  name: "Orders",
                                  color: YELLOW_COLOR,
                                },
                                {
                                  dataKey: "invoiced_revenue_myr",
                                  name: "Invoiced",
                                  color: GREEN_COLOR,
                                },
                                {
                                  dataKey: "collected_revenue_myr",
                                  name: "Collected",
                                  color: PURPLE_COLOR,
                                },
                              ]}
                            />
                          </ChartCard>
                          {/* Replaces "Invoice (SAP) vs Pipeline (CRM)
                              Revenue" (2026-10-01) -- that chart compared two
                              different O2C stages that were never expected to
                              match (won pipeline vs invoiced revenue are
                              different stages entirely), a real source of
                              confusion per direct feedback. This is CRM
                              Forecast 1's own trend instead: won revenue
                              against the monthly quota it's actually judged
                              against. */}
                          <ChartCard
                            title="Pipeline vs Target (RM)"
                            subtitle={trendSubtitle}
                            style="cardGapSmall"
                          >
                            <LineChartRenderer
                              data={pipelineVsTargetData}
                              lines={[
                                {
                                  dataKey: "Pipeline (Won)",
                                  color: BLUE_COLOR,
                                },
                                { dataKey: "Target", color: YELLOW_COLOR },
                              ]}
                            />
                          </ChartCard>
                          {/* Renamed from "Invoiced / Collected / Budget"
                              (2026-10-01) -- same data/3 lines (Collected
                              still plotted as "Payment"), reframed as SAP
                              Forecast 2's own attainment trend, the natural
                              pair to Pipeline vs Target above (CRM forecast
                              vs SAP forecast, side by side, never blended --
                              see docs/DASHBOARD-ROADMAP.md §1.2). */}
                          <ChartCard
                            title="Revenue vs Budget (RM)"
                            subtitle={trendSubtitle}
                            style="cardGapSmall"
                          >
                            <LineChartRenderer
                              data={invoicedVsBudgetTrendData}
                              lines={[
                                { dataKey: "Invoice", color: BLUE_COLOR },
                                { dataKey: "Payment", color: GREEN_COLOR },
                                { dataKey: "Budget", color: YELLOW_COLOR },
                              ]}
                            />
                          </ChartCard>
                        </CardLayout>
                      </div>
                    </div>
                  </div>

                  {/* NEEDS ATTENTION (new, 2026-08, SAL-manager only) */}
                  {/* {canSeeNeedsAttention &&
                    needsAttentionScorecard.length > 0 && (
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
                              <WarningCircleIcon size={24} />
                              <h2 className="textL textBold">
                                Needs Attention
                              </h2>
                            </div>
                            <p className="textXS textLight">
                              Behind budget, sitting on an unbilled backlog, or
                              collecting below pace — worth a 1:1 this period.
                            </p>
                          </div>

                          <ScorecardList data={needsAttentionScorecard} />
                        </div>
                      </div>
                    )} */}

                  <div className="pdfOverviewSection">
                    {/* REP FUNNEL SCORECARD (renamed from "Invoice Budget
                        Scorecard", extended 2026-08 with the Collected leg) */}
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
                          <UsersThreeIcon size={24} />
                          <h2 className="textL textBold">
                            Rep Funnel Scorecard
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Per-rep Sales Order vs Invoice vs Collected vs Budget
                          variance — SAP-recognized, backward looking, audited.
                          Distinct from Leads Overview's CRM pipeline scorecard.
                        </p>
                      </div>

                      {invoiceBudgetScorecard.length > 0 ? (
                        <ScorecardList data={invoiceBudgetScorecard} />
                      ) : (
                        <NoResult title="No invoice-budget rows for this period yet." />
                      )}
                    </div>
                  </div>

                  <div className="pdfOverviewSection">
                    {/* PIPELINE-STAGE DETAIL */}
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
                          <ChartPieIcon size={24} />
                          <h2 className="textL textBold">
                            Pipeline-Stage Detail
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Where WON revenue is coming from — stage, product,
                          source, and account concentration.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Pipeline Stage (RM — Won Actual, Others Expected)"
                          subtitle={`${periodLabel}`}
                          style="cardGapSmall"
                          viewAllTo="../leads/list"
                          // No date bounds -- this chart's own RPC condition
                          // is an OR across created_at/closed_date that only
                          // degrades to something clean when unfiltered, same
                          // simplification already applied to Leads
                          // Overview's own "Lead Stages" chart.
                          viewAllFilter={{
                            ...chartBaseFilterCRM,
                            cancelled: "false",
                          }}
                        >
                          <HorizontalBarChartRenderer
                            data={stageData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Product-Type Mix by Won Revenue (RM)"
                          subtitle={`${periodLabel}`}
                          style="cardGapSmall"
                          viewAllTo="../leads/list"
                          viewAllFilter={{
                            ...chartBaseFilterCRM,
                            stage: "WON",
                            ...chartClosedPeriodFilter,
                          }}
                        >
                          <HorizontalBarChartRenderer
                            data={productTypeData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Lead-Source ROI by Won Revenue (RM)"
                          subtitle={`${periodLabel}`}
                          style="cardGapSmall"
                          viewAllTo="../leads/list"
                          viewAllFilter={{
                            ...chartBaseFilterCRM,
                            stage: "WON",
                            ...chartClosedPeriodFilter,
                          }}
                        >
                          <HorizontalBarChartRenderer
                            data={sourceData}
                            colorMap={GREEN_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Top Clients by Won Revenue (RM)"
                          subtitle={`${periodLabel}`}
                          style="cardGapSmall"
                          viewAllTo="../leads/list"
                          viewAllFilter={{
                            ...chartBaseFilterCRM,
                            stage: "WON",
                            ...chartClosedPeriodFilter,
                          }}
                        >
                          <HorizontalBarChartRenderer
                            data={topClientsData}
                            colorMap="#ef4444"
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>

                    {/* ORDER-STAGE DETAIL */}
                    <div
                      style={{
                        justifyContent: "start",
                        textAlign: "start",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          marginBottom: "1rem",
                          gap: "0.4rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.8rem",
                          }}
                        >
                          <RankingIcon size={24} />
                          <h2 className="textL textBold">Order-Stage Detail</h2>
                        </div>
                        <p className="textXS textLight">
                          SAP sales orders booked, by rep and over time.
                        </p>

                        <CardLayout style="cardLayout2">
                          <ChartCard
                            title="Sales Orders by Rep (RM)"
                            subtitle={`${periodLabel}`}
                            style="cardGapSmall"
                            viewAllTo={
                              canAccessOrders ? "../orders" : undefined
                            }
                            viewAllFilter={{ ...chartPeriodFilter }}
                          >
                            <HorizontalBarChartRenderer
                              data={orderBookData}
                              colorMap={BLUE_COLOR}
                            />
                          </ChartCard>
                          {/* Moved back here from Order-to-Cash Overview
                              (2026-10-01) -- this is an operational booking-
                              to-billing lag metric for Order-Stage detail,
                              not a big-picture overview chart. */}
                          <ChartCard
                            title="Orders vs Invoiced Revenue (RM)"
                            subtitle="Trailing 12 Months — Not Affected by the Date Filter"
                            style="cardGapSmall"
                          >
                            <LineChartRenderer
                              data={bookingsVsInvoicedTrendData}
                              lines={[
                                {
                                  dataKey: "Sales Order (Booked)",
                                  color: YELLOW_COLOR,
                                },
                                {
                                  dataKey: "Invoice (Billed)",
                                  color: GREEN_COLOR,
                                },
                              ]}
                            />
                          </ChartCard>
                        </CardLayout>
                      </div>
                    </div>

                    {/* INVOICE-STAGE DETAIL */}
                    <div style={{ marginTop: "1.6rem" }}>
                      <div style={{ marginBottom: "1rem" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.8rem",
                          }}
                        >
                          <ReceiptIcon size={24} />
                          <h2 className="textL textBold">
                            Invoice-Stage Detail
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Revenue/GP by rep, products, and where invoiced
                          revenue is concentrated.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Revenue & Gross Profit by Rep (RM)"
                          subtitle={`${periodLabel}`}
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessInvoices
                              ? "/app/finance/invoices/list"
                              : undefined
                          }
                          viewAllFilter={{ ...chartPeriodFilter }}
                        >
                          <HorizontalMultiBarRenderer
                            data={grossProfitByRepData}
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
                          title="Top Customers by Invoiced Revenue (RM)"
                          subtitle={`Top 10, ${periodLabel}`}
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessInvoices
                              ? "/app/finance/invoices/list"
                              : undefined
                          }
                          viewAllFilter={{ ...chartPeriodFilter }}
                        >
                          <HorizontalMultiBarRenderer
                            data={topInvoicedCustomersData}
                            bars={[
                              {
                                dataKey: "Invoiced",
                                name: "Invoiced",
                                color: YELLOW_COLOR,
                              },
                              {
                                dataKey: "Collected",
                                name: "Collected",
                                color: GREEN_COLOR,
                              },
                            ]}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Top Products by Invoiced Revenue (RM)"
                          subtitle={`Top 10, ${periodLabel}`}
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={topProductsData}
                            colorMap={GREEN_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Product Groups by Invoiced Revenue (RM)"
                          subtitle={`All Groups, ${periodLabel}`}
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={revenueByProductGroupData}
                            colorMap={PURPLE_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>
                  </div>

                  <div className="pdfOverviewSection">
                    {/* PAYMENT-STAGE DETAIL (new, 2026-10-01) -- completes the
                        4-stage O2C narrative (Pipeline -> Order -> Invoice ->
                        Payment); Payments Collected previously had no
                        dedicated detail charts beyond the cross-stage
                        Overview trend. */}
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
                          <WalletIcon size={24} />
                          <h2 className="textL textBold">
                            Payment-Stage Detail
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Who's actually paying, and how collection is pacing
                          against what's been invoiced, by rep.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Top Customers by Payments Collected (RM)"
                          subtitle={`Top 10, ${periodLabel}`}
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessPayments
                              ? "/app/finance/invoices/payments"
                              : undefined
                          }
                          viewAllFilter={{ ...chartPeriodFilter }}
                        >
                          <HorizontalBarChartRenderer
                            data={topPaymentCustomersData}
                            colorMap={YELLOW_COLOR}
                          />
                        </ChartCard>

                        {/* New (2026-10-01) -- the ACTIONABLE counterpart to
                            the chart above: not "who paid the most" but "who
                            still owes the most, right now" -- see the RPC's
                            own outstanding_by_customer comment for why this
                            uses sap_invoices_with_balance's cumulative
                            balance rather than a same-period subtraction. */}
                        <ChartCard
                          title="Top Outstanding Payments by Customer (RM)"
                          subtitle={`Top 10, ${actionableLabel}`}
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessInvoices
                              ? "/app/finance/invoices/list"
                              : undefined
                          }
                          viewAllFilter={{ hasBalanceOnly: "true" }}
                        >
                          <HorizontalBarChartRenderer
                            data={outstandingByCustomerData}
                            colorMap="#ef4444"
                          />
                        </ChartCard>

                        <ChartCard
                          title="Collection Rate by Rep (%)"
                          subtitle={`${periodLabel}`}
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={collectionRateByRepData}
                            colorMap={GREEN_COLOR}
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

export default Reports;
