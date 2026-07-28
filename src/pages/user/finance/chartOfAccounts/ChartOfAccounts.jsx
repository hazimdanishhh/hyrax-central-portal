import { TreeStructureIcon } from "@phosphor-icons/react";
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
import { fetchChartOfAccounts } from "../../../../features/finance/chartOfAccounts/private/api/chartOfAccountsService";
import { getChartOfAccountsFilterConfig } from "./filterConfig";
import { chartOfAccountsTableConfig } from "./tableConfig";

/**
 * Read-only Chart of Accounts reference list -- SAP is the system of
 * record, so there's no create/edit/delete here, just
 * search/filter/sort/paginate over sap_gl_accounts (OACT). Added 2026-07
 * alongside the Journal Entries list page -- pairs naturally with it (e.g.
 * looking up what an account_code on a journal line actually means). Flat
 * reference/master data, not transactional, so no date-range filter and no
 * line-level drill-down.
 */
export default function ChartOfAccounts() {
  const { darkMode } = useTheme();

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

  const filterConfig = getChartOfAccountsFilterConfig();
  const columns = chartOfAccountsTableConfig();
  const hasData = accounts.length > 0;

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

            <PageResult
              data={accounts}
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
                <DataTable data={accounts} columns={columns} rowKey="account_code" />
              )}
            </div>
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
