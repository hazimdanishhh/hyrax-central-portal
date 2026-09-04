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
} from "@phosphor-icons/react";

import CardLayout from "../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../components/chartCard/HorizontalMultiBarRenderer";
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

  // finance/invoices and finance/payments are FIN-only, while this page is
  // SAL/MGM -- same cross-department gate Finance's own dashboard already
  // uses for its own links (canAccessFinanceOps). Without this, a Sales
  // manager clicking Invoice Budget Attainment/Customer Concentration/
  // Payments Collected would hit "Unauthorized."
  const canAccessInvoices = canAccess({ departments: ["FIN"] });
  const canAccessPayments = canAccess({ departments: ["FIN"] });

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
  const overviewItems = getSalesReportsOverviewConfig(
    kpis,
    invoiceBudgetScorecardData,
    topInvoicedCustomersRaw,
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
    ...(filters.productType && { productType: filters.productType }),
  };
  const chartIsPeriodFiltered =
    Boolean(filters.startDate) && Boolean(filters.endDate);
  const chartPeriodFilter = chartIsPeriodFiltered
    ? { startDate: filters.startDate, endDate: filters.endDate }
    : {};
  const chartClosedPeriodFilter = chartIsPeriodFiltered
    ? { closedDateFrom: filters.startDate, closedDateTo: filters.endDate }
    : {};

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

  // Series renamed 2026-07 (source-labeling clarity pass, see
  // DASHBOARD-CONVENTIONS.md): the chart title's own "(SAP)"/"(CRM)" tags
  // already disambiguate, so the legend inside just names each source table
  // plainly -- "Pipeline" (sales_leads) vs "Invoice" (sap_invoices), not the
  // more generic "Realized."
  const realizedVsPipelineData =
    dashboard?.realizedVsPipelineData?.map((d) => ({
      name: d.period,
      Pipeline: d.pipeline_revenue_myr,
      Invoice: d.realized_revenue_myr,
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

  const topInvoicedCustomersData = topInvoicedCustomersRaw.map((d) => ({
    name: d.customer_name,
    value: d.revenue_myr,
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
  const stageData =
    dashboard?.stageData?.map((d) => ({
      name: d.name,
      value: d.count,
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
                          Pipeline, orders, invoices, and collections — the same
                          Order-to-Cash flow, top to bottom.
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
                            The Order-to-Cash Funnel
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Where this period's revenue is right now — from
                          pipeline won to cash collected.
                        </p>

                        <CardLayout style="cardLayout2">
                          <ChartCard
                            title="Pipeline → Order → Invoice → Payment"
                            subtitle="This period (RM) — each stage tagged by source"
                            style="cardGapSmall"
                          >
                            <HorizontalBarChartRenderer
                              data={o2cFunnelData}
                              colorMap={BLUE_COLOR}
                            />
                          </ChartCard>
                          <ChartCard
                            title="Invoice (SAP) vs Pipeline (CRM) Revenue"
                            subtitle="Two systems of record, side by side — not blended"
                            style="cardGapSmall"
                          >
                            <LineChartRenderer
                              data={realizedVsPipelineData}
                              lines={[
                                { dataKey: "Pipeline", color: BLUE_COLOR },
                                { dataKey: "Invoice", color: GREEN_COLOR },
                              ]}
                            />
                          </ChartCard>
                        </CardLayout>
                      </div>
                    </div>
                  </div>

                  {/* NEEDS ATTENTION (new, 2026-08, SAL-manager only) */}
                  {canSeeNeedsAttention &&
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
                    )}

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
                          title="Pipeline Stage"
                          subtitle="Leads by Stage (Count) — Discovery to Won/Lost"
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
                          title="Product-Type Mix"
                          subtitle="Won Revenue (RM)"
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
                          title="Lead-Source ROI"
                          subtitle="Won Revenue (RM)"
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
                          title="Top Clients"
                          subtitle="Won Revenue (RM)"
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
                            title="Order Book by Rep"
                            subtitle="SAP Sales Orders (RM)"
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
                          <ChartCard
                            title="Bookings vs Invoiced Revenue"
                            subtitle="SAP Sales Orders vs SAP Invoices, trailing 12 months (RM) — not affected by the date filter"
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
                          title="Gross Profit by Rep"
                          subtitle="Revenue & GP (RM)"
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessInvoices
                              ? "/app/finance/invoices"
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
                          title="Top Customers by Invoiced Revenue"
                          subtitle="SAP Invoiced (RM)"
                          style="cardGapSmall"
                          viewAllTo={
                            canAccessInvoices
                              ? "/app/finance/invoices"
                              : undefined
                          }
                          viewAllFilter={{ ...chartPeriodFilter }}
                        >
                          <HorizontalBarChartRenderer
                            data={topInvoicedCustomersData}
                            colorMap={YELLOW_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Top Products"
                          subtitle="SAP Invoiced (RM) — actual sales, not CRM pipeline"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={topProductsData}
                            colorMap={GREEN_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Revenue by Product Group"
                          subtitle="SAP Invoiced (RM) — all products, not just the top 10"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={revenueByProductGroupData}
                            colorMap={PURPLE_COLOR}
                          />
                        </ChartCard>
                      </CardLayout>

                      <div style={{ marginTop: "1.6rem" }}>
                        <ChartCard
                          title="Invoiced / Collected / Budget"
                          subtitle="Monthly, this period's date filter applies (all time if unset)"
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
                      </div>
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
