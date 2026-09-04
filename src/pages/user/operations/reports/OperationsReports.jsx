import {
  GaugeIcon,
  ChartBarHorizontalIcon,
  ArchiveIcon,
  TruckIcon,
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
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import ExportActions from "../../../../components/exportActions/ExportActions";
import useDashboardQuery from "../../../../hooks/useDashboardQuery";
import { fetchOperationsDashboard } from "../../../../features/operations/reports/private/api/fetchOperationsDashboard";
import { useOperationsMetadata } from "../../../../features/operations/reports/private/hooks/useOperationsMetadata";
import { getFilterConfig } from "./config/filterConfig";
import { getOperationsOverviewConfig } from "./config/overviewConfig";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { formatDateTime } from "../../../../functions/formatDate";
import { useRef } from "react";

export default function OperationsReports() {
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
    queryKey: "operations_dashboard",
    queryFn: fetchOperationsDashboard,
  });

  const {
    dataFreshness,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useOperationsMetadata();

  const filterConfig = getFilterConfig();

  const isLoading = dashboardLoading || metadataLoading;
  const isFetching = dashboardFetching || metadataFetching;
  const isError = dashboardError || metadataError;

  const kpis = dashboard?.kpis ?? {};
  const overviewItems = getOperationsOverviewConfig(kpis);

  // Always "as of today" -- backlog age, not a period flow.
  const backlogAgingData =
    dashboard?.backlogAgingData?.map((d) => ({
      name: d.bucket,
      value: d.open_value_myr,
    })) ?? [];

  const shipmentTrendData =
    dashboard?.shipmentTrendData?.map((d) => ({
      name: d.month,
      Deliveries: d.delivery_count,
    })) ?? [];

  const topUndeliveredItemsData =
    dashboard?.topUndeliveredItemsData?.map((d) => ({
      name: d.item_name,
      value: d.open_qty,
    })) ?? [];

  const stockPositionData =
    dashboard?.stockPositionData?.map((d) => ({
      name: d.item_name,
      stock_on_hand: d.stock_on_hand,
      committed_stock: d.committed_stock,
    })) ?? [];

  // Stock by Product Group (added 2026-09, Item Grouping) -- same On
  // Hand/Committed pair as Stock Position above, aggregated across ALL
  // active items per SAP item group (OITB), not just the top 10 individual
  // items. See
  // hyrax-data-platform/docs/sap-data-architecture-plans/09-item-grouping-execution-plan.md.
  const stockByProductGroupData =
    dashboard?.stockByProductGroupData?.map((d) => ({
      name: d.item_group_name,
      stock_on_hand: d.stock_on_hand,
      committed_stock: d.committed_stock,
    })) ?? [];

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={TruckIcon} current="Operations Reports" />

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

            <div className="generalCard redCard">
              <span className="textBold">Note: </span>
              <li className="textLight textS textStart textBullet">
                Report is inaccurate as delivery data is unused by logistics
                department.
              </li>
              <li className="textLight textS textStart textBullet">
                Data begins in March 2018 and ends in January 2020, with an
                additional small data set in May 2022.
              </li>
            </div>

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
                fileName="Operations_Dashboard_Report"
                reportTitle="Operations Dashboard"
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
                          <h2 className="textL textBold">Operations KPIs</h2>
                        </div>
                        <p className="textXS textLight">
                          Order backlog, delivery performance, and fulfilment
                          speed.
                        </p>
                      </div>

                      <OverviewCards items={overviewItems} />
                    </div>
                  </div>

                  <div className="pdfOverviewSection">
                    {/* TIER 2: FULFILMENT HEALTH */}
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
                          <h2 className="textL textBold">Fulfilment Health</h2>
                        </div>
                        <p className="textXS textLight">
                          How old is the open backlog, and how much are we
                          shipping over time.
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Backlog Aging"
                          subtitle="As of today — not affected by date filter"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={backlogAgingData}
                            colorMap={BLUE_COLOR}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Shipment Volume Trend"
                          subtitle="Deliveries per month"
                          style="cardGapSmall"
                        >
                          <LineChartRenderer
                            data={shipmentTrendData}
                            lines={[
                              { dataKey: "Deliveries", color: GREEN_COLOR },
                            ]}
                          />
                        </ChartCard>
                      </CardLayout>
                    </div>

                    {/* TIER 3: BACKLOG & STOCK DETAIL */}
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
                          <ArchiveIcon size={24} />
                          <h2 className="textL textBold">
                            Backlog &amp; Stock Detail
                          </h2>
                        </div>
                        <p className="textXS textLight">
                          Which items are most undelivered, and where stock is
                          over-committed. Company-wide only — per-warehouse
                          breakdown requires further SAP extraction (see the
                          department dashboard blueprint).
                        </p>
                      </div>

                      <CardLayout style="cardLayout2">
                        <ChartCard
                          title="Top Undelivered Items"
                          subtitle="Open quantity"
                          style="cardGapSmall"
                        >
                          <HorizontalBarChartRenderer
                            data={topUndeliveredItemsData}
                            colorMap="#ef4444"
                          />
                        </ChartCard>

                        <ChartCard
                          title="Stock Position"
                          subtitle="On hand vs committed — most over-committed items first"
                          style="cardGapSmall"
                        >
                          <HorizontalMultiBarRenderer
                            data={stockPositionData}
                            bars={[
                              {
                                dataKey: "stock_on_hand",
                                name: "On Hand",
                                color: BLUE_COLOR,
                              },
                              {
                                dataKey: "committed_stock",
                                name: "Committed",
                                color: "#ef4444",
                              },
                            ]}
                          />
                        </ChartCard>

                        <ChartCard
                          title="Stock by Product Group"
                          subtitle="On hand vs committed — all active items, by SAP item group"
                          style="cardGapSmall"
                        >
                          <HorizontalMultiBarRenderer
                            data={stockByProductGroupData}
                            bars={[
                              {
                                dataKey: "stock_on_hand",
                                name: "On Hand",
                                color: BLUE_COLOR,
                              },
                              {
                                dataKey: "committed_stock",
                                name: "Committed",
                                color: "#ef4444",
                              },
                            ]}
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
