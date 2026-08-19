import { useState } from "react";
import { FileTextIcon } from "@phosphor-icons/react";
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
import { fetchInvoices } from "../../../../features/finance/invoices/private/api/invoicesService";
import { useFinanceMetadata } from "../../../../features/finance/reports/private/hooks/useFinanceMetadata";
import { getInvoicesFilterConfig } from "./filterConfig";
import { invoicesTableConfig } from "./tableConfig";
import InvoiceSidebar from "./detail/InvoiceSidebar";
import InvoiceCard from "../../../../components/finance/invoiceCard/InvoiceCard";

/**
 * Read-only invoices list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_invoices. This is the drill-through target for the Finance dashboard's
 * Revenue Invoiced / Outstanding AR / Overdue Risk KPI cards.
 */
export default function Invoices() {
  const { darkMode } = useTheme();
  const [selectedRow, setSelectedRow] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    data: invoices,
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
    isLoading: invoicesLoading,
    isFetching: invoicesFetching,
    error: invoicesError,
  } = usePaginatedQuery({
    queryKey: "finance_invoices",
    queryFn: fetchInvoices,
    pageSize: 20,
    defaultSortBy: "invoice_date",
    defaultSortOrder: "descending",
  });

  const {
    salesReps,
    isLoading: metadataLoading,
    isFetching: metadataFetching,
    error: metadataError,
  } = useFinanceMetadata();

  const filterConfig = getInvoicesFilterConfig({ salesReps });
  const columns = invoicesTableConfig();

  const isLoading = invoicesLoading || metadataLoading;
  const isFetching = invoicesFetching || metadataFetching;
  const error = invoicesError || metadataError;
  const hasData = invoices.length > 0;

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
          <Breadcrumbs icon={FileTextIcon} current="Invoices" />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search invoices..."
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
              data={invoices}
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
                <CardLayout style="cardLayout1 cardPaddingSmall cardGapSmall">
                  {invoices.map((invoice) => (
                    <InvoiceCard
                      key={invoice.doc_entry}
                      invoice={invoice}
                      onClick={() => handleOpenSidebar(invoice)}
                    />
                  ))}
                </CardLayout>
              )}
            </div>
          </CardWrapper>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title="Invoice Detail"
            icon={FileTextIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <InvoiceSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </section>
  );
}
