import { useMemo } from "react";
import { HandCoinsIcon } from "@phosphor-icons/react";
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
import { fetchVendorPayments } from "../../../../features/finance/vendorPayments/private/api/vendorPaymentsService";
import { useVendorPayment } from "../../../../features/finance/vendorPayments/private/hooks/useVendorPayment";
import { getVendorPaymentsFilterConfig } from "./filterConfig";
import VendorPaymentSidebar from "./detail/VendorPaymentSidebar";
import VendorPaymentCard from "../../../../components/finance/vendorPaymentCard/VendorPaymentCard";

/**
 * Read-only vendor payments list -- SAP is the system of record, so there's
 * no create/edit/delete here, just search/filter/sort/paginate over
 * sap_vendor_payments. AP mirror of Payments.jsx. This is the drill-through
 * target for the Finance dashboard's Cash Paid KPI and the Unallocated
 * Outgoing Payments chart.
 */
export default function VendorPayments() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { docEntry } = useParams();
  const [searchParams] = useSearchParams();

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

  const { data: fetchedVendorPayment } = useVendorPayment(docEntry);

  // Find selected row based on URL param -- in-memory paginated list first
  // (instant UI for a click from the list), falling back to the
  // fetch-by-id result (direct/shared URL). Same shape as Orders.jsx's
  // selectedRow.
  const selectedRow = useMemo(() => {
    if (!docEntry) return null;

    const vendorPaymentInList = vendorPayments?.find(
      (vendorPayment) => String(vendorPayment.doc_entry) === docEntry,
    );
    if (vendorPaymentInList) return vendorPaymentInList;

    return fetchedVendorPayment || null;
  }, [docEntry, vendorPayments, fetchedVendorPayment]);

  const sidebarOpen = !!selectedRow;

  const filterConfig = getVendorPaymentsFilterConfig();
  const hasData = vendorPayments.length > 0;

  function handleCloseSidebar() {
    navigate(`/app/finance/vendor-payments?${searchParams.toString()}`);
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
              placeholder="Search by Payment# or Vendor Name..."
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
                  {vendorPayments.map((vendorPayment) => (
                    <VendorPaymentCard
                      key={vendorPayment.doc_entry}
                      vendorPayment={vendorPayment}
                      to={`${vendorPayment.doc_entry}?${searchParams.toString()}`}
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
