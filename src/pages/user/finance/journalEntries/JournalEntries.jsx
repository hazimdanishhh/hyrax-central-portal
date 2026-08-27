import { useMemo } from "react";
import { BookOpenIcon } from "@phosphor-icons/react";
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
import DataTable from "../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../components/dataSidebar/DataSidebar";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import { fetchJournalEntries } from "../../../../features/finance/journalEntries/private/api/journalEntriesService";
import { useJournalEntry } from "../../../../features/finance/journalEntries/private/hooks/useJournalEntry";
import { getJournalEntriesFilterConfig } from "./filterConfig";
import { journalEntriesTableConfig } from "./tableConfig";
import JournalEntrySidebar from "./detail/JournalEntrySidebar";

/**
 * Read-only General Ledger journal entries list -- SAP is the system of
 * record, so there's no create/edit/delete here, just
 * search/filter/sort/paginate over sap_gl_journal_entries (OJDT). Added
 * 2026-07 to close the one genuine list-page gap from Finance Expansion
 * Phase 2 -- until now, GL data was only visible as aggregate dashboard
 * figures on Finance Reports, with no way to browse individual
 * transactions.
 */
export default function JournalEntries() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { transId } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: journalEntries,
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
    queryKey: "finance_journal_entries",
    queryFn: fetchJournalEntries,
    pageSize: 20,
    defaultSortBy: "posting_date",
    defaultSortOrder: "descending",
  });

  const { data: fetchedJournalEntry } = useJournalEntry(transId);

  // Find selected row based on URL param -- in-memory paginated list first
  // (instant UI for a click from the list), falling back to the
  // fetch-by-id result (direct/shared URL). Same shape as Orders.jsx's
  // selectedRow, keyed by trans_id instead of doc_entry.
  const selectedRow = useMemo(() => {
    if (!transId) return null;

    const entryInList = journalEntries?.find(
      (entry) => String(entry.trans_id) === transId,
    );
    if (entryInList) return entryInList;

    return fetchedJournalEntry || null;
  }, [transId, journalEntries, fetchedJournalEntry]);

  const sidebarOpen = !!selectedRow;

  const filterConfig = getJournalEntriesFilterConfig();
  const columns = journalEntriesTableConfig();
  const hasData = journalEntries.length > 0;

  function handleOpenSidebar(row) {
    navigate(`${row.trans_id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(`/app/finance/journal-entries?${searchParams.toString()}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={BookOpenIcon} current="Journal Entries" />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search journal entries..."
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
              data={journalEntries}
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
                <DataTable
                  data={journalEntries}
                  columns={columns}
                  rowKey="trans_id"
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
            title="Journal Entry Detail"
            icon={BookOpenIcon}
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            isEditing={false}
          >
            <JournalEntrySidebar selectedRow={selectedRow} />
          </DataSidebar>
        )}
      </AnimatePresence>
    </section>
  );
}
