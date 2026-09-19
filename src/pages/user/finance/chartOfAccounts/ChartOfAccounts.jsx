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
 * reference/master data, not transactional, so no date-range filter and no
 * line-level drill-down of its own -- clicking a postable account instead
 * jumps to Journal Entries, pre-filtered to that account (accountCode
 * filter, see journalEntriesService.js) -- "what GL activity produced this
 * balance." Non-postable summary/title accounts (is_postable='N') aren't
 * clickable -- they never have journal lines posted directly to them.
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
    if (account.is_postable !== "Y") return;
    navigate(`/app/finance/journal-entries?accountCode=${account.account_code}`);
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
