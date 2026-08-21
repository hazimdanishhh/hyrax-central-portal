import { useMemo } from "react";
import { CoinsIcon } from "@phosphor-icons/react";
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
import { fetchPayments } from "../../../../features/finance/payments/private/api/paymentsService";
import { usePayment } from "../../../../features/finance/payments/private/hooks/usePayment";
import { getPaymentsFilterConfig } from "./filterConfig";
import PaymentSidebar from "./detail/PaymentSidebar";
import PaymentCard from "../../../../components/finance/paymentCard/PaymentCard";

/**
 * Read-only payments list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_payments. This is the drill-through target for the Finance dashboard's
 * Cash Collected KPI and the Unallocated Payments chart.
 */
export default function Payments() {
  const { darkMode } = useTheme();
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
    setPage,
    setSearch,
    setFilters,
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

  const filterConfig = getPaymentsFilterConfig();
  const hasData = payments.length > 0;

  function handleOpenSidebar(row) {
    navigate(`${row.doc_entry}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/finance/payments?${searchParams.toString()}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={CoinsIcon} current="Payments" />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search by Receipt# or Customer Name..."
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
              data={payments}
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
                  {payments.map((payment) => (
                    <PaymentCard
                      key={payment.doc_entry}
                      payment={payment}
                      onClick={() => handleOpenSidebar(payment)}
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
    </section>
  );
}
