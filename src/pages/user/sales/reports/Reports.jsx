import { useRef } from "react";
import {
  GaugeIcon,
  UsersThreeIcon,
  RankingIcon,
  ChartPieIcon,
  ChartBarIcon,
  WarningIcon,
} from "@phosphor-icons/react";

import CardLayout from "../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../components/chartCard/HorizontalBarChartRenderer";
import HorizontalMultiBarRenderer from "../../../../components/chartCard/HorizontalMultiBarRenderer";
import LineChartRenderer from "../../../../components/chartCard/LineChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
} from "../../../../components/chartCard/chartColors";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../components/crud/noResult/NoResult";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import ExportActions from "../../../../components/exportActions/ExportActions";
import ScorecardList from "../../../../components/sales/leads/leadsScoreCard/LeadsScoreCard";
import useDashboardQuery from "../../../../hooks/useDashboardQuery";
import { fetchSalesReportsDashboard } from "../../../../features/sales/reports/private/api/fetchSalesReportsDashboard";
import { useSalesReportsMetadata } from "../../../../features/sales/reports/private/hooks/useSalesReportsMetadata";
import { getFilterConfig } from "./config/filterConfig";
import { getSalesReportsOverviewConfig } from "./config/overviewConfig";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { formatDateTime } from "../../../../functions/formatDate";

function Reports() {
  const { darkMode } = useTheme();
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
    queryKey: "sales_reports_dashboard",
    queryFn: fetchSalesReportsDashboard,
  });

  console.log(dashboard);

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
  const invoiceBudgetScorecardData =
    dashboard?.invoiceBudgetScorecardData ?? [];
  const overviewItems = getSalesReportsOverviewConfig(
    kpis,
    invoiceBudgetScorecardData,
  );

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
  }));

  const realizedVsPipelineData =
    dashboard?.realizedVsPipelineData?.map((d) => ({
      name: d.period,
      "Pipeline (CRM)": d.pipeline_revenue_myr,
      "Realized (SAP)": d.realized_revenue_myr,
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

  const topClientsData =
    dashboard?.topClientsData?.map((d) => ({
      name: d.name,
      value: d.won_revenue,
    })) ?? [];

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
                  <div className="pdfOverviewSection">
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
                          <h2 className="textL textBold">Sales KPIs</h2>
                        </div>
                        <p className="textXS textLight">
                          Both forecasts, order book, and sales cycle health.
                        </p>
                      </div>

                      <OverviewCards items={overviewItems} />
                    </div>
                  </div>

                  <div className="pdfOverviewSection">
                    {/* TIER 2: THE TWO FORECASTS, IN DETAIL */}
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
                            Invoice Budget Scorecard
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Per-rep SAP-recognized revenue vs budget — backward
                          looking, audited. Distinct from Leads Overview's CRM
                          pipeline scorecard.
                        </p>
                      </div>

                      {invoiceBudgetScorecard.length > 0 ? (
                        <ScorecardList data={invoiceBudgetScorecard} />
                      ) : (
                        <NoResult title="No invoice-budget rows for this period yet." />
                      )}
                    </div>

                    <div style={{ marginTop: "1.6rem" }}>
                      <ChartCard
                        title="Realized (SAP) vs Pipeline (CRM) Revenue"
                        subtitle="Two systems of record, side by side — not blended"
                        style="cardGapSmall"
                      >
                        <LineChartRenderer
                          data={realizedVsPipelineData}
                          lines={[
                            { dataKey: "Pipeline (CRM)", color: BLUE_COLOR },
                            { dataKey: "Realized (SAP)", color: GREEN_COLOR },
                          ]}
                        />
                      </ChartCard>
                    </div>
                  </div>

                  <div className="pdfOverviewSection">
                    {/* TIER 3: ORDER BOOK & PROFITABILITY */}
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
                            Order Book &amp; Profitability
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          SAP sales orders booked, and revenue/GP by rep.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Order Book by Rep"
                          subtitle="SAP Sales Orders (RM)"
                          style="cardGapSmall"
                          viewAllTo="../orders"
                        >
                          <HorizontalBarChartRenderer
                            data={orderBookData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Gross Profit by Rep"
                          subtitle="Revenue & GP (RM)"
                          style="cardGapSmall"
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
                      </CardLayout>
                    </div>

                    {/* TIER 4: PIPELINE COMPOSITION */}
                    <div style={{ marginTop: "1.6rem" }}>
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
                            Pipeline Composition
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Where WON revenue is coming from — product, source,
                          and account concentration.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Product-Type Mix"
                          subtitle="Won Revenue (RM)"
                          style="cardGapSmall"
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
                        >
                          <HorizontalBarChartRenderer
                            data={topClientsData}
                            colorMap="#ef4444"
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
