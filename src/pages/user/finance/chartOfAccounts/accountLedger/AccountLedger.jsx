import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TreeStructureIcon, BookOpenIcon } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTheme } from "../../../../../context/ThemeContext";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../../components/crud/pageResult/PageResult";
import DataTable from "../../../../../components/dataTable/DataTable";
import DataSidebar from "../../../../../components/dataSidebar/DataSidebar";
import DetailFieldGrid from "../../../../../components/dataSidebar/DetailFieldGrid";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import VerticalMultiBarRenderer from "../../../../../components/chartCard/VerticalMultiBarRenderer";
import { BLUE_COLOR } from "../../../../../components/chartCard/chartColors";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../../hooks/usePaginatedQuery";
import {
  fetchAccountLedgerLines,
  fetchGlAccountByCode,
} from "../../../../../features/finance/chartOfAccounts/private/api/accountLedgerService";
import { useAccountMonthlySummary } from "../../../../../features/finance/chartOfAccounts/private/hooks/useAccountMonthlySummary";
import { useJournalEntry } from "../../../../../features/finance/journalEntries/private/hooks/useJournalEntry";
import JournalEntrySidebar from "../../journalEntries/detail/JournalEntrySidebar";
import { DRAWER_LABELS } from "../drawerLabels";
import { accountLedgerTableConfig } from "./tableConfig";
import PageTitle from "../../../../../components/pageTitle/PageTitle";

// Trailing 12 months from today -- only used when the URL has no explicit
// date-range filter (e.g. opened fresh from Chart of Accounts). When
// Financial Reports links here instead, it always passes an explicit
// startDate/endDate (the fiscal year/period already selected there), which
// takes priority via filters.startDate/endDate below. The ledger TABLE
// itself has no such default -- it shows full history, paginated, same as
// Journal Entries' own unfiltered case -- this default is only for the
// "Monthly Balance" chart specifically, which needs a bounded window to stay
// readable; the "Per Annum" chart (added 2026-09) is always full history
// regardless of this filter.
function getDefaultChartRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 11);
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { startDate: toISO(start), endDate: toISO(end) };
}

function monthLabel(monthDateStr) {
  return new Date(monthDateStr).toLocaleDateString("en-MY", {
    month: "short",
    year: "numeric",
  });
}

// April (month index 3) onward belongs to the fiscal year starting this
// calendar year -- same April-March rule as fiscalYearPresets.js's own
// getCurrentFiscalYearStartYear, just applied to an arbitrary month instead
// of "today", and kept local since it's one line -- see that file for the
// canonical version this mirrors.
function fiscalYearLabel(monthDateStr) {
  const d = new Date(monthDateStr);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

/**
 * Read-only line-level ledger for a single GL account -- replaces what used
 * to be Chart of Accounts' direct jump to Journal Entries filtered by
 * accountCode. That filter resolved to whole multi-account entries (and
 * their entry-wide totals) that merely contained a line touching the
 * account, not this account's own activity -- see ChartOfAccounts.jsx's own
 * header comment for the full reasoning. Also the drill-down destination for
 * Financial Reports' Operating Expense Breakdown bars (added 2026-09) --
 * built as a general "tell me about this account" destination from the
 * start, not one-off wired to either caller.
 */
export default function AccountLedger() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { accountCode, transId } = useParams();
  const [searchParams] = useSearchParams();

  const {
    data: lines,
    totalCount,
    page,
    totalPages,
    filters,
    activeFilters,
    hasActiveFilters,
    sorting,
    setSorting,
    setPage,
    setFilters,
    resetParams,
    isLoading,
    isFetching,
    error,
  } = usePaginatedQuery({
    queryKey: `account_ledger_${accountCode}`,
    queryFn: fetchAccountLedgerLines,
    pageSize: 20,
    defaultSortBy: "posting_date",
    defaultSortOrder: "descending",
    extraParams: { accountCode },
  });

  const { data: account } = useQuery({
    queryKey: ["gl_account", accountCode],
    queryFn: () => fetchGlAccountByCode(accountCode),
    enabled: !!accountCode,
    staleTime: 1000 * 60,
  });

  // ONE always-unbounded fetch backs all three charts below -- see
  // useAccountMonthlySummary.js's own comment for why this isn't three
  // separate RPC calls.
  const { data: monthlySummary, isLoading: chartLoading } =
    useAccountMonthlySummary(accountCode);

  const defaultChartRange = useMemo(() => getDefaultChartRange(), []);
  const periodStartDate = filters.startDate || defaultChartRange.startDate;
  const periodEndDate = filters.endDate || defaultChartRange.endDate;

  // Chart 1: Monthly Balance, filtered to the page's own date-range/fiscal-
  // year filter (or the trailing-12-months default above) -- sliced from
  // the same all-time array, not a separate fetch.
  const periodChartData = useMemo(
    () =>
      (monthlySummary || [])
        .filter(
          (row) => row.month >= periodStartDate && row.month <= periodEndDate,
        )
        .map((row) => ({
          name: monthLabel(row.month),
          balanceMyr: Math.round(row.balanceMyr),
        })),
    [monthlySummary, periodStartDate, periodEndDate],
  );

  // Chart 2: Per Annum -- all-time monthly rows grouped into fiscal years
  // (April-March, same convention as FiscalYearFilterBar/
  // fiscalYearPresets.js elsewhere in this app). Each month's net
  // debit-credit activity is SUMMED into its fiscal year -- correct for a
  // flow figure (an expense/revenue account's yearly total spend/earned);
  // for a balance-sheet account (Assets/Liabilities/Equity), this shows the
  // year's own net movement, not a running point-in-time balance -- same
  // flow-based figure the Monthly Balance/All-Time Monthly charts already
  // show per month, just rolled up to a year.
  const perAnnumChartData = useMemo(() => {
    const totals = {};

    (monthlySummary || []).forEach((row) => {
      const label = fiscalYearLabel(row.month);
      totals[label] = (totals[label] || 0) + row.balanceMyr;
    });

    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, balanceMyr]) => ({
        name,
        balanceMyr: Math.round(balanceMyr),
      }));
  }, [monthlySummary]);

  const { data: fetchedJournalEntry } = useJournalEntry(transId);

  // Find selected row based on URL param -- same in-memory-list-first,
  // fetch-by-id-fallback shape as JournalEntries.jsx's own selectedRow. A
  // ledger line already carries every field JournalEntrySidebar needs
  // (posting_date/memo/reference_1/reference_2/trans_type came through
  // sap_gl_journal_lines_with_entry_info's own join), so no extra fetch is
  // needed for the in-list case.
  const selectedRow = useMemo(() => {
    if (!transId) return null;

    const lineInList = lines?.find((line) => String(line.trans_id) === transId);
    if (lineInList) return lineInList;

    return fetchedJournalEntry || null;
  }, [transId, lines, fetchedJournalEntry]);

  const sidebarOpen = !!selectedRow;
  const columns = accountLedgerTableConfig();
  const hasData = lines.length > 0;

  function handleOpenSidebar(line) {
    navigate(`${line.trans_id}?${searchParams.toString()}`);
  }

  function handleCloseSidebar() {
    navigate(
      `/app/finance/chart-of-accounts/${accountCode}?${searchParams.toString()}`,
    );
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs
            icon={BookOpenIcon}
            current={`${
              account ? DRAWER_LABELS[account.drawer] || account.drawer : null
            } - ${account?.account_name || accountCode}`}
            icon1={TreeStructureIcon}
            to1="/app/finance/chart-of-accounts"
            name1="Chart of Accounts"
          />

          <CardWrapper>
            <SearchFilterBar
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={[]}
              enableDateRange
              disableSearch
            />

            <FiscalYearFilterBar
              filters={filters}
              onFilterChange={setFilters}
            />

            {hasActiveFilters && (
              <ActiveFiltersBar
                filters={activeFilters}
                setFilters={setFilters}
                filterConfig={[]}
                resetParams={resetParams}
              />
            )}

            <CardLayout style="cardLayout2">
              <ChartCard
                title="Monthly Balance"
                subtitle="Net debit/credit activity per month (RM) — filtered to the date range/fiscal year above"
              >
                {chartLoading ? (
                  <LoadingIcon />
                ) : periodChartData.length === 0 ? (
                  <NoResult />
                ) : (
                  <LineChartRenderer
                    data={periodChartData}
                    lines={[{ dataKey: "balanceMyr", color: BLUE_COLOR }]}
                    showLegend={false}
                  />
                )}
              </ChartCard>

              <ChartCard
                title="Per Annum"
                subtitle="Net debit/credit activity per fiscal year (RM, April–March) — every year on record"
              >
                {chartLoading ? (
                  <LoadingIcon />
                ) : perAnnumChartData.length === 0 ? (
                  <NoResult />
                ) : (
                  <VerticalMultiBarRenderer
                    data={perAnnumChartData}
                    bars={[
                      {
                        dataKey: "balanceMyr",
                        name: "Balance (RM)",
                        color: BLUE_COLOR,
                      },
                    ]}
                  />
                )}
              </ChartCard>
            </CardLayout>

            <PageResult
              data={lines}
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
                  data={lines}
                  columns={columns}
                  rowKey="ledger_row_id"
                  onRowClick={handleOpenSidebar}
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
