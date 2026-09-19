import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TreeStructureIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import PageResult from "../../../../components/crud/pageResult/PageResult";
import DataTable from "../../../../components/dataTable/DataTable";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import usePaginatedQuery from "../../../../hooks/usePaginatedQuery";
import {
  fetchChartOfAccounts,
  fetchAllChartOfAccounts,
} from "../../../../features/finance/chartOfAccounts/private/api/chartOfAccountsService";
import { buildAccountHierarchy } from "../../../../functions/buildAccountHierarchy";
import { getChartOfAccountsFilterConfig } from "./filterConfig";
import { chartOfAccountsTableConfig } from "./tableConfig";

/**
 * Read-only Chart of Accounts reference list -- SAP is the system of
 * record, so there's no create/edit/delete here, just
 * search/filter/sort/paginate over sap_gl_accounts (OACT). Added 2026-07
 * alongside the Journal Entries list page -- pairs naturally with it (e.g.
 * looking up what an account_code on a journal line actually means). Flat
 * reference/master data, not transactional, so no date-range filter of its
 * own.
 *
 * Every row is clickable (added 2026-09 for non-postable rows -- previously
 * a dead end, since is_postable='N' summary/title accounts never have
 * journal lines posted directly to them). Both destinations live at the
 * same route, `AccountDetail.jsx` branching on `is_postable`:
 * - Postable account -> Account Ledger (added 2026-09, replacing this
 *   page's previous "jump to Journal Entries filtered by accountCode"
 *   behavior). That filter resolved to whole multi-account entries that
 *   merely CONTAINED a line touching the account -- then showed entry-wide
 *   fields (including the entry's Total Debit/Credit, which bundles every
 *   OTHER account's lines in the same entry too), not this account's own
 *   activity. Confirmed as a real bug, not just a design preference:
 *   filtering by "Salaries, bonus & allowance" showed Total Debit = Total
 *   Credit = 1,956,551 for FY2026-2027, a symmetric figure only possible
 *   when summing whole balanced entries -- while Financial Reports' own
 *   per-account Opex Breakdown figure for the same account/period was
 *   567,669. Account Ledger instead lists this account's own LINES
 *   directly, via sap_gl_journal_lines_with_entry_info.
 * - Non-postable/title account -> Category Detail (added 2026-09) -- its
 *   direct children (postable or further sub-categories) plus the same two
 *   movement charts Account Ledger has, summed across every postable
 *   descendant. Deliberately shows direct children only, not a flattened
 *   every-descendant view -- matches both SAP Business One's own native
 *   drill-down (drawer -> title -> subordinate accounts, one level at a
 *   time) and general accounting UX best practice.
 */
export default function ChartOfAccounts() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  const {
    data: accounts,
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
    queryKey: "finance_chart_of_accounts",
    queryFn: fetchChartOfAccounts,
    pageSize: 20,
    defaultSortBy: "account_code",
    defaultSortOrder: "ascending",
  });

  // Hierarchy/tree view (added 2026-09) -- only in the default (no search,
  // no filter) view; the moment either is active, fall back to the existing
  // flat/paginated/filtered list above exactly as before. See
  // fetchAllChartOfAccounts' own comment for why a full unpaginated fetch is
  // the right call for this page specifically.
  const isTreeMode = !hasActiveFilters;

  const { data: allAccounts, isLoading: isTreeLoading } = useQuery({
    queryKey: ["finance_chart_of_accounts", "tree"],
    queryFn: fetchAllChartOfAccounts,
    enabled: isTreeMode,
    staleTime: 1000 * 60,
  });

  const accountTree = useMemo(
    () => (allAccounts ? buildAccountHierarchy(allAccounts) : []),
    [allAccounts],
  );

  const filterConfig = getChartOfAccountsFilterConfig();
  const columns = chartOfAccountsTableConfig();
  const hasData = isTreeMode ? accountTree.length > 0 : accounts.length > 0;

  function handleRowClick(account) {
    navigate(`/app/finance/chart-of-accounts/${account.account_code}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={TreeStructureIcon} current="Chart of Accounts" />

          <CardWrapper>
            <SearchFilterBar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={filterConfig}
              placeholder="Search chart of accounts..."
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

            {isTreeMode ? (
              <p className="textXXS textLight" style={{ padding: "8px 4px" }}>
                Showing the full account hierarchy ({allAccounts?.length || 0}{" "}
                accounts). Search or filter to switch to a flat list.
              </p>
            ) : (
              <PageResult
                data={accounts}
                totalCount={totalCount}
                page={page}
                setPage={setPage}
                totalPages={totalPages}
                error={error}
              />
            )}

            <div className="cardWrapperScroll">
              {(isTreeMode ? isTreeLoading : isLoading || isFetching) ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : !hasData ? (
                <NoResult />
              ) : error ? (
                <NoResult title="Error loading results" />
              ) : isTreeMode ? (
                <DataTable
                  data={accountTree}
                  columns={columns}
                  rowKey="account_code"
                  onRowClick={handleRowClick}
                  getSubRows={(row) => row.children}
                />
              ) : (
                <DataTable
                  data={accounts}
                  columns={columns}
                  rowKey="account_code"
                  onRowClick={handleRowClick}
                />
              )}
            </div>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
