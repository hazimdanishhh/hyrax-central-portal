import { useMemo } from "react";
import { InvoiceIcon } from "@phosphor-icons/react";
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
import { fetchBills } from "../../../../features/finance/bills/private/api/billsService";
import { useBill } from "../../../../features/finance/bills/private/hooks/useBill";
import { getBillsFilterConfig } from "./filterConfig";
import { getBillsOverviewConfig } from "./overviewConfig";
import { useBillsOverview } from "../../../../features/finance/bills/private/hooks/useBillsOverview";
import BillSidebar from "./detail/BillSidebar";
import BillCard from "../../../../components/finance/billCard/BillCard";
import OverviewCards from "../../../../components/crud/overviewCards/OverviewCards";

/**
 * Read-only vendor bills list -- SAP is the system of record, so there's no
 * create/edit/delete here, just search/filter/sort/paginate over
 * sap_vendor_bills. This is the drill-through target for the Finance
 * dashboard's Bills Received / Outstanding AP / Overdue Payables KPI cards
 * (Finance Expansion Phase 1, added 2026-07).
 */
export default function Bills() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { docEntry } = useParams();
  const [searchParams] = useSearchParams();

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

  const { data: fetchedBill } = useBill(docEntry);

  // Find selected row based on URL param -- in-memory paginated list first
  // (instant UI for a click from the list), falling back to the
  // fetch-by-id result (direct/shared URL). Same shape as Orders.jsx's
  // selectedRow.
  const selectedRow = useMemo(() => {
    if (!docEntry) return null;

    const billInList = bills?.find(
      (bill) => String(bill.doc_entry) === docEntry,
    );
    if (billInList) return billInList;

    return fetchedBill || null;
  }, [docEntry, bills, fetchedBill]);

  const sidebarOpen = !!selectedRow;

  const { kpis } = useBillsOverview();
  const overviewItems = getBillsOverviewConfig(kpis);

  const filterConfig = getBillsFilterConfig();
  const hasData = bills.length > 0;

  function handleCloseSidebar() {
    navigate(`/app/finance/bills?${searchParams.toString()}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={InvoiceIcon} current="Bills" />

          <CardWrapper>
            <OverviewCards items={overviewItems} style="overviewCard2" />

            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search by BILL# or Vendor Name..."
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
              data={bills}
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
                  {bills.map((bill) => (
                    <BillCard
                      key={bill.doc_entry}
                      bill={bill}
                      to={`${bill.doc_entry}?${searchParams.toString()}`}
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
            title="Bill Detail"
            icon={InvoiceIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <BillSidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </section>
  );
}
