import { useMemo } from "react";
import { CoinsIcon } from "@phosphor-icons/react";
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
import { fetchPayments } from "../../../../features/finance/payments/private/api/paymentsService";
import { usePayment } from "../../../../features/finance/payments/private/hooks/usePayment";
import { getPaymentsFilterConfig } from "./filterConfig";
import { getPaymentsOverviewConfig } from "./overviewConfig";
import { getPaymentsSortConfig } from "./sortConfig";
import { usePaymentsOverview } from "../../../../features/finance/payments/private/hooks/usePaymentsOverview";
import PaymentSidebar from "./detail/PaymentSidebar";
import PaymentCard from "../../../../components/finance/paymentCard/PaymentCard";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";

/**
 * Read-only payments list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_payments. This is the drill-through target for the Finance dashboard's
 * Cash Collected KPI and the Unallocated Payments chart.
 */
export default function Payments() {
  const navigate = useNavigate();
  const { docEntry } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: payments,
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
    isLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: "finance_payments",
    queryFn: fetchPayments,
    pageSize: 20,
    defaultSortBy: "payment_date",
    defaultSortOrder: "descending",
  });

  const { data: fetchedPayment } = usePayment(docEntry);

  // Find selected row based on URL param -- in-memory paginated list first
  // (instant UI for a click from the list), falling back to the
  // fetch-by-id result (direct/shared URL). Same shape as Orders.jsx's
  // selectedRow.
  const selectedRow = useMemo(() => {
    if (!docEntry) return null;

    const paymentInList = payments?.find(
      (payment) => String(payment.doc_entry) === docEntry,
    );
    if (paymentInList) return paymentInList;

    return fetchedPayment || null;
  }, [docEntry, payments, fetchedPayment]);

  const sidebarOpen = !!selectedRow;

  const { kpis } = usePaymentsOverview(filters, search);
  const overviewItems = getPaymentsOverviewConfig(kpis);

  const filterConfig = getPaymentsFilterConfig();
  const sortOptions = getPaymentsSortConfig();
  const hasData = payments.length > 0;

  function handleCloseSidebar() {
    navigate(`/app/finance/invoices/payments?${searchParams.toString()}`);
  }

  return (
    <>
      <OverviewCards items={overviewItems} />

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFilterChange={setFilters}
        filterConfig={filterConfig}
        placeholder="Search by Receipt# or Customer Name..."
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
        data={payments}
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
            {payments.map((payment) => (
              <PaymentCard
                key={payment.doc_entry}
                payment={payment}
                to={`${payment.doc_entry}?${searchParams.toString()}`}
              />
            ))}
          </CardLayout>
        )}
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <DataSidebar
            title="Payment Detail"
            icon={CoinsIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <PaymentSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </>
  );
}
