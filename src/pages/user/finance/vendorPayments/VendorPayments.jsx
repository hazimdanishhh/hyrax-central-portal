import { useState } from "react";
import { HandCoinsIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import DataTable from "../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchVendorPayments } from "../../../../features/finance/vendorPayments/private/api/vendorPaymentsService";
import { getVendorPaymentsFilterConfig } from "./filterConfig";
import { vendorPaymentsTableConfig } from "./tableConfig";
import VendorPaymentSidebar from "./detail/VendorPaymentSidebar";

/**
 * Read-only vendor payments list -- SAP is the system of record, so there's
 * no create/edit/delete here, just search/filter/sort/paginate over
 * sap_vendor_payments. AP mirror of Payments.jsx. This is the drill-through
 * target for the Finance dashboard's Cash Paid KPI and the Unallocated
 * Outgoing Payments chart.
 */
export default function VendorPayments() {
  const { darkMode } = useTheme();
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    data: vendorPayments,
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
    isLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: "finance_vendor_payments",
    queryFn: fetchVendorPayments,
    pageSize: 20,
    defaultSortBy: "payment_date",
    defaultSortOrder: "descending",
  });

  const filterConfig = getVendorPaymentsFilterConfig();
  const columns = vendorPaymentsTableConfig();
  const hasData = vendorPayments.length > 0;

  function handleOpenSidebar(row) {
    setSelectedRow(row);
    setSidebarOpen(true);
  }

  function handleCloseSidebar() {
    setSidebarOpen(false);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={HandCoinsIcon} current="Vendor Payments" />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search vendor payments..."
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

            <PageResult
              data={vendorPayments}
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
                  data={vendorPayments}
                  columns={columns}
                  rowKey="doc_entry"
                  onRowClick={handleOpenSidebar}
                />
              )}
            </div>
          </CardWrapper>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title="Vendor Payment Detail"
            icon={HandCoinsIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <VendorPaymentSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </section>
  );
}
