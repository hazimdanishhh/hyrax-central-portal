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
import { useJournalEntriesOverview } from "../../../../features/finance/journalEntries/private/hooks/useJournalEntriesOverview";
import {
  getJournalEntriesFilterConfig,
  getJournalEntryRowFlags,
} from "./filterConfig";
import { journalEntriesTableConfig } from "./tableConfig";
import JournalEntrySidebar from "./detail/JournalEntrySidebar";
import "./JournalEntries.scss";

/**
 * Read-only General Ledger journal entries list -- SAP is the system of
 * record, so there's no create/edit/delete here, just
 * search/filter/sort/paginate over sap_gl_journal_entries (OJDT). Added
 * 2026-07 to close the one genuine list-page gap from Finance Expansion
 * Phase 2 -- until now, GL data was only visible as aggregate dashboard
 * figures on Finance Reports, with no way to browse individual
 * transactions.
 *
 * Deliberately NO OverviewCards strip here (added 2026-09, alongside the
 * new "Total" summary below) -- this page is a documented historical audit
 * trail, not an operational queue (docs/finance/FINANCE-MODULE-CAPABILITIES
 * .md), and DASHBOARD-CONVENTIONS.md §2a is explicit that a KPI-card strip
 * on flat/audit-trail data is "decoration, not decision support." The Total
 * count/debit/credit is still genuinely useful information, so it's shown
 * as a plain text line (see get_journal_entries_overview_rpc.sql) instead
 * of a card -- same underlying number Invoices/Bills would put on a Total
 * tile, different presentation because this page's own nature differs from
 * theirs. Sorting uses TanStack's sortable column headers (`sorting`/
 * `setSorting`/`manualSorting` below), not a legacy SortBar dropdown --
 * this page already renders as a real DataTable (Invoices/Bills render as
 * card lists instead, where a sortable header has no equivalent), and
 * sortable headers are this app's own preferred convention over SortBar
 * for anything that's already a table.
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
    sorting,
    setSorting,
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

  const { kpis: overviewKpis } = useJournalEntriesOverview(filters, search);

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

            {/* Plain text, not an OverviewCards tile -- see this page's own
                header comment for why. Always shown (matches every
                overview's total figure regardless of filter state), even
                though the unfiltered case aggregates this page's full
                history -- see get_journal_entries_overview_rpc.sql's own
                performance-caution comment. */}

            <div className="journalEntriesTotalContainer">
              <p className="textXXS">
                <span className="textBold">Total Debit: </span>{" "}
                {Math.round(overviewKpis.totalDebitMyr).toLocaleString()}
              </p>

              <p className="textXXS">
                <span className="textBold">Total Credit: </span>{" "}
                {Math.round(overviewKpis.totalCreditMyr).toLocaleString()}
              </p>
            </div>

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
                  getRowFlags={getJournalEntryRowFlags}
                  flagTooltipTitle="Exceptions"
                  sorting={sorting}
                  onSortingChange={setSorting}
                  manualSorting
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
