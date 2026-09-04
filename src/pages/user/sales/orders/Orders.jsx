import { useMemo } from "react";
import { ReceiptIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchSalesOrders } from "../../../../features/sales/orders/private/api/salesOrdersService";
import { useSalesOrder } from "../../../../features/sales/orders/private/hooks/useSalesOrder";
import { useSalesOrdersMetadata } from "../../../../features/sales/orders/private/hooks/useSalesOrdersMetadata";
import { getSalesOrdersFilterConfig } from "./filterConfig";
import { getSalesOrdersOverviewConfig } from "./overviewConfig";
import { useSalesOrdersOverview } from "../../../../features/sales/orders/private/hooks/useSalesOrdersOverview";
import SalesOrderCard from "../../../../components/sales/orders/salesOrderCard/SalesOrderCard";
import SalesOrderSidebar from "./detail/SalesOrderSidebar";
import PageTitle from "../../../../components/pageTitle/PageTitle";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";

/**
 * Read-only sales orders list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_sales_orders. This is the drill-through target for the Sales Reports
 * dashboard's Order Book KPI card and Order Book by Rep chart.
 *
 * Row-click opens the detail sidebar via a real URL
 * (/app/sales/orders/all/:docEntry), not local state -- mirrors
 * LeadsManagement.jsx's :leadId pattern (2026-08) so a matched-order card
 * elsewhere in the app (LeadSidebar.jsx) or a future notification can
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
    setPage,
    setSearch,
    setFilters,
    resetParams,
    isLoading: ordersLoading,
    isFetching: ordersFetching,
    error: ordersError,
  } = usePaginatedQuery({
    queryKey: "sales_orders",
    queryFn: fetchSalesOrders,
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

  const { data: fetchedOrder } = useSalesOrder(docEntry);

  // Find selected row based on URL param -- in-memory paginated list first
  // (instant UI for a click from the list), falling back to the
  // fetch-by-id result (direct/shared URL, or a notification linking
  // straight to an order). Same shape as LeadsManagement.jsx's selectedRow.
  const selectedRow = useMemo(() => {
    if (!docEntry) return null;

    const orderInList = salesOrders?.find(
      (order) => String(order.doc_entry) === docEntry,
    );
    if (orderInList) return orderInList;

    return fetchedOrder || null;
  }, [docEntry, salesOrders, fetchedOrder]);

  const sidebarOpen = !!selectedRow;

  const { kpis } = useSalesOrdersOverview();
  const overviewItems = getSalesOrdersOverviewConfig(kpis);

  const filterConfig = getSalesOrdersFilterConfig({ salesReps });

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
        subtitle="View and manage your sales orders, details and status"
      />

      <OverviewCards items={overviewItems} />

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

      <PageResult
        data={salesOrders}
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
          <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
            {salesOrders.map((order) => (
              <SalesOrderCard
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
            // fullPage
          >
            <SalesOrderSidebar
              selectedRow={selectedRow}
              salesReps={salesReps}
            />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
