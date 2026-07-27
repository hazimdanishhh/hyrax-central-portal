import { useState } from "react";
import { InvoiceIcon } from "@phosphor-icons/react";
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
import { fetchBills } from "../../../../features/finance/bills/private/api/billsService";
import { getBillsFilterConfig } from "./filterConfig";
import { billsTableConfig } from "./tableConfig";
import BillSidebar from "./detail/BillSidebar";

/**
 * Read-only vendor bills list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_vendor_bills. This is the drill-through target for the Finance
 * dashboard's Bills Received / Outstanding AP / Overdue Payables KPI cards
 * (Finance Expansion Phase 1, added 2026-07).
 */
export default function Bills() {
  const { darkMode } = useTheme();
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    data: bills,
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
    queryKey: "finance_bills",
    queryFn: fetchBills,
    pageSize: 20,
    defaultSortBy: "bill_date",
    defaultSortOrder: "descending",
  });

  const filterConfig = getBillsFilterConfig();
  const columns = billsTableConfig();
  const hasData = bills.length > 0;

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
          <Breadcrumbs icon={InvoiceIcon} current="Bills" />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search bills..."
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
              data={bills}
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
                  data={bills}
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
            title="Bill Detail"
            icon={InvoiceIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
            fullPage
          >
            <BillSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </section>
  );
}
