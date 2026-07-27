import { useState } from "react";
import { ReceiptIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import DataTable from "../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchSalesOrders } from "../../../../features/sales/orders/private/api/salesOrdersService";
import { useSalesOrdersMetadata } from "../../../../features/sales/orders/private/hooks/useSalesOrdersMetadata";
import { getSalesOrdersFilterConfig } from "./filterConfig";
import { salesOrdersTableConfig } from "./tableConfig";
import SalesOrderSidebar from "./detail/SalesOrderSidebar";

/**
 * Read-only sales orders list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_sales_orders. This is the drill-through target for the Sales Reports
 * dashboard's Order Book KPI card and Order Book by Rep chart.
 */
export default function Orders() {
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const filterConfig = getSalesOrdersFilterConfig({ salesReps });
  const columns = salesOrdersTableConfig();

  const isLoading = ordersLoading || metadataLoading;
  const isFetching = ordersFetching || metadataFetching;
  const error = ordersError || metadataError;
  const hasData = salesOrders.length > 0;

  function handleOpenSidebar(row) {
    setSelectedRow(row);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
  }

  return (
    <>
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search sales orders..."
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

      <div className="cardWrapperScroll generalCard">
        {isLoading || isFetching ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : !hasData ? (
          <NoResult />
        ) : error ? (
          <NoResult title="Error loading results" />
        ) : (
          <DataTable
            data={salesOrders}
            columns={columns}
            rowKey="doc_entry"
            onRowClick={handleOpenSidebar}
          />
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
            fullPage
          >
            <SalesOrderSidebar selectedRow={selectedRow} salesReps={salesReps} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
