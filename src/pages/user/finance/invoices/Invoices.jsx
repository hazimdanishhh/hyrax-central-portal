import { useMemo } from "react";
import { FileTextIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchInvoices } from "../../../../features/finance/invoices/private/api/invoicesService";
import { useInvoice } from "../../../../features/finance/invoices/private/hooks/useInvoice";
import { useFinanceMetadata } from "../../../../features/finance/reports/private/hooks/useFinanceMetadata";
import { getInvoicesFilterConfig } from "./filterConfig";
import { getInvoicesOverviewConfig } from "./overviewConfig";
import { useInvoicesOverview } from "../../../../features/finance/invoices/private/hooks/useInvoicesOverview";
import InvoiceSidebar from "./detail/InvoiceSidebar";
import InvoiceCard from "../../../../components/finance/invoiceCard/InvoiceCard";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";

/**
 * Read-only invoices list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_invoices. This is the drill-through target for the Finance dashboard's
 * Revenue Invoiced / Outstanding AR / Overdue Risk KPI cards.
 */
export default function Invoices() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { docEntry } = useParams();
  const [searchParams] = useSearchParams();

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

  const { data: fetchedInvoice } = useInvoice(docEntry);

  // Find selected row based on URL param -- in-memory paginated list first
  // (instant UI for a click from the list), falling back to the
  // fetch-by-id result (direct/shared URL, or a matched-order card
  // deep-linking straight to an invoice). Same shape as Orders.jsx's
  // selectedRow.
  const selectedRow = useMemo(() => {
    if (!docEntry) return null;

    const invoiceInList = invoices?.find(
      (invoice) => String(invoice.doc_entry) === docEntry,
    );
    if (invoiceInList) return invoiceInList;

    return fetchedInvoice || null;
  }, [docEntry, invoices, fetchedInvoice]);

  const sidebarOpen = !!selectedRow;

  const { kpis } = useInvoicesOverview();
  const overviewItems = getInvoicesOverviewConfig(kpis);

  const filterConfig = getInvoicesFilterConfig({ salesReps });

  const isLoading = invoicesLoading || metadataLoading;
  const isFetching = invoicesFetching || metadataFetching;
  const error = invoicesError || metadataError;
  const hasData = invoices.length > 0;

  function handleCloseSidebar() {
    navigate(`/app/finance/invoices?${searchParams.toString()}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={FileTextIcon} current="Invoices" />

          <CardWrapper>
            <OverviewCards items={overviewItems} style="overviewCard2" />

            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search by INV# or Customer Name..."
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
                  {invoices.map((invoice) => (
                    <InvoiceCard
                      key={invoice.doc_entry}
                      invoice={invoice}
                      to={`${invoice.doc_entry}?${searchParams.toString()}`}
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
