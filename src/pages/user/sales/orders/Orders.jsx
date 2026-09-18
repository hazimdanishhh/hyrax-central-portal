import { useMemo } from "react";
import { ReceiptIcon } from "@phosphor-icons/react";
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
import { fetchFulfillmentOrders } from "../../../../features/sales/orders/private/api/fulfillmentOrdersService";
import { useFulfillmentOrder } from "../../../../features/sales/orders/private/hooks/useFulfillmentOrder";
import { useFulfillmentOverview } from "../../../../features/sales/orders/private/hooks/useFulfillmentOverview";
import { useSalesOrdersMetadata } from "../../../../features/sales/orders/private/hooks/useSalesOrdersMetadata";
import { getSalesOrdersFilterConfig } from "./filterConfig";
import { getSalesOrdersOverviewConfig } from "./overviewConfig";
import { getSalesOrdersSortConfig } from "./sortConfig";
import { getSalesOrdersTabsConfig } from "./tabConfig";
import FulfillmentOrderCard from "../../../../components/sales/orders/fulfillmentOrderCard/FulfillmentOrderCard";
import SalesOrderSidebar from "./detail/SalesOrderSidebar";
import PageTitle from "../../../../components/pageTitle/PageTitle";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";
import StatusTab from "../../../../components/crud/statusTab/StatusTab";

/**
 * Sales Orders -- SAP is the system of record, so there's no create/edit/
 * delete here, just search/filter/sort/paginate over
 * sap_sales_orders_with_fulfillment, tracing each order all the way through
 * Delivered -> Invoiced -> Fully Paid. This is the drill-through target for
 * the Sales Reports dashboard's Order Book KPI card and Order Book by Rep
 * chart, a Lead's "Matched SAP Sales Order" card, and an Invoice's "Matched
 * Sales Order" card.
 *
 * Backed by the enriched view rather than the raw sap_sales_orders table --
 * see fulfillmentOrdersService.js's own header comment for how its
 * pagination count avoids paying that view's full aggregation cost on an
 * unfiltered/bookmarked load.
 *
 * Row-click opens the detail sidebar via a real URL
 * (/app/sales/orders/all/:docEntry), not local state -- mirrors
 * LeadsManagement.jsx's :leadId pattern so a matched-order card elsewhere in
 * the app (LeadSidebar.jsx, InvoiceSidebar.jsx) or a future notification can
 * deep-link straight to one specific order.
 */
export default function Orders() {
  const navigate = useNavigate();
  const { docEntry } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: salesOrders,
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
    queryKey: "sales_orders",
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
  // fetch-by-id result (direct/shared URL, or a notification linking
  // straight to an order).
  const selectedRow = useMemo(() => {
    if (!docEntry) return null;

    const orderInList = salesOrders?.find(
      (order) => String(order.doc_entry) === docEntry,
    );
    if (orderInList) return orderInList;

    return fetchedOrder || null;
  }, [docEntry, salesOrders, fetchedOrder]);

  const sidebarOpen = !!selectedRow;

  const { kpis } = useFulfillmentOverview(filters, search);
  const overviewItems = getSalesOrdersOverviewConfig(kpis);

  const filterConfig = getSalesOrdersFilterConfig({ salesReps });
  const sortOptions = getSalesOrdersSortConfig();

  const statusTabs = getSalesOrdersTabsConfig(searchParams);

  const isLoading = ordersLoading || metadataLoading;
  const isFetching = ordersFetching || metadataFetching;
  const error = ordersError || metadataError;
  const hasData = salesOrders.length > 0;

  function handleCloseSidebar() {
    navigate(`/app/sales/orders/all?${searchParams.toString()}`);
  }

  return (
    <>
      <PageTitle
        title="Sales Orders"
        subtitle="Track every SAP order from lead match through delivery, invoicing and payment"
      />

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

      <FiscalYearFilterBar filters={filters} onFilterChange={setFilters} />

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
        data={salesOrders}
        totalCount={totalCount}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        error={error}
      />

      <div className="statusTabsRow scrollbar">
        {statusTabs.map((tab) => (
          <StatusTab
            key={tab.label}
            to={tab.to}
            label={tab.label}
            themeType={tab.themeType}
            isActive={tab.isActive}
          />
        ))}
      </div>

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
            {salesOrders.map((order) => (
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
            title="Sales Order Detail"
            icon={ReceiptIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <SalesOrderSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
