import { useMemo } from "react";
import { TruckIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageHeader from "../../../../components/crud/pageHeader/PageHeader";
import SortBar from "../../../../components/crud/sortBar/SortBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchFulfillmentOrders } from "../../../../features/sales/fulfillment/private/api/fulfillmentOrdersService";
import { useFulfillmentOrder } from "../../../../features/sales/fulfillment/private/hooks/useFulfillmentOrder";
import { useSalesOrdersMetadata } from "../../../../features/sales/orders/private/hooks/useSalesOrdersMetadata";
import { getFulfillmentOrdersFilterConfig } from "./filterConfig";
import { getFulfillmentOrdersSortConfig } from "./sortConfig";
import { getFulfillmentOverviewConfig } from "./overviewConfig";
import { useFulfillmentOverview } from "../../../../features/sales/fulfillment/private/hooks/useFulfillmentOverview";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import FulfillmentOrderCard from "../../../../components/sales/fulfillment/fulfillmentOrderCard/FulfillmentOrderCard";
import FulfillmentOrderSidebar from "./detail/FulfillmentOrderSidebar";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import { useTheme } from "../../../../context/ThemeContext";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";

/**
 * Fulfillment Tracker -- the standalone Lead -> Order -> Delivered ->
 * Invoiced -> Fully Paid pipeline view, graduated 2026-09 from an
 * experimental sidebar on the Sales Orders page (see
 * docs/SALES-ORDER-PIPELINE-ROADMAP.md §2.2). Deliberately its own page
 * rather than added onto Sales Orders' own fast paginated list -- backed by
 * sap_sales_orders_with_fulfillment, whose `left join lateral` rollups make
 * this page the heavier one by design (this app's own Tier 1 List vs Tier 3
 * Report distinction), while Sales Orders stays on the raw sap_sales_orders
 * table it was reverted back to.
 *
 * Row-click opens the detail sidebar via a real URL
 * (/app/sales/fulfillment/:docEntry), not local state -- same pattern as
 * Orders.jsx's own :docEntry route.
 */
export default function FulfillmentTracker() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { docEntry } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: fulfillmentOrders,
    totalCount,
    page,
    totalPages,
    search,
    filters,
    activeFilters,
    hasActiveFilters,
    sortBy,
    sortOrder,
    setPage,
    setSearch,
    setFilters,
    setSortBy,
    setSortOrder,
    resetParams,
    isLoading: ordersLoading,
    isFetching: ordersFetching,
    error: ordersError,
  } = usePaginatedQuery({
    queryKey: "fulfillment_orders",
    queryFn: fetchFulfillmentOrders,
    pageSize: 20,
    defaultSortBy: "order_date",
    defaultSortOrder: "descending",
  });

  const {
    salesReps,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useSalesOrdersMetadata();

  const { data: fetchedOrder } = useFulfillmentOrder(docEntry);

  // Find selected row based on URL param -- in-memory paginated list first
  // (instant UI for a click from the list), falling back to the
  // fetch-by-id result (direct/shared URL). Same shape as Orders.jsx's own
  // selectedRow.
  const selectedRow = useMemo(() => {
    if (!docEntry) return null;

    const orderInList = fulfillmentOrders?.find(
      (order) => String(order.doc_entry) === docEntry,
    );
    if (orderInList) return orderInList;

    return fetchedOrder || null;
  }, [docEntry, fulfillmentOrders, fetchedOrder]);

  const sidebarOpen = !!selectedRow;

  const { kpis } = useFulfillmentOverview(filters, search);
  const overviewItems = getFulfillmentOverviewConfig(kpis);

  const filterConfig = getFulfillmentOrdersFilterConfig({ salesReps });
  const sortOptions = getFulfillmentOrdersSortConfig();

  const isLoading = ordersLoading || metadataLoading;
  const isFetching = ordersFetching || metadataFetching;
  const error = ordersError || metadataError;
  const hasData = fulfillmentOrders.length > 0;

  function handleCloseSidebar() {
    navigate(`/app/sales/fulfillment?${searchParams.toString()}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={TruckIcon} current="Fulfillment Tracker" />

          <CardWrapper>
            <OverviewCards items={overviewItems} style="overviewCard2" />

            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search by SO#, PO# or Customer Name..."
              enableDateRange
            />

            <FiscalYearFilterBar
              filters={filters}
              onFilterChange={setFilters}
            />

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

            <PageHeader>
              <SortBar
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOptions={sortOptions}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
              />
            </PageHeader>

            <PageResult
              data={fulfillmentOrders}
              totalCount={totalCount}
              page={page}
              setPage={setPage}
              totalPages={totalPages}
              error={error}
            />

            <div className="cardWrapperScroll">
              {isLoading || isFetching ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData ? (
                <NoResult />
              ) : error ? (
                <NoResult title="Error loading results" />
              ) : (
                <CardLayout style="cardLayout2 cardPaddingSmall cardGapSmall">
                  {fulfillmentOrders.map((order) => (
                    <FulfillmentOrderCard
                      key={order.doc_entry}
                      order={order}
                      to={`${order.doc_entry}?${searchParams.toString()}`}
                    />
                  ))}
                </CardLayout>
              )}
            </div>

            <AnimatePresence>
              {sidebarOpen && (
                <DataSidebar
                  title="Fulfillment Detail"
                  icon={TruckIcon}
                  open={sidebarOpen}
                  onClose={handleCloseSidebar}
                  isEditing={false}
                >
                  <FulfillmentOrderSidebar selectedRow={selectedRow} />
                </DataSidebar>
              )}
            </AnimatePresence>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
