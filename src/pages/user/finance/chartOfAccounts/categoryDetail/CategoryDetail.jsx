import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TreeStructureIcon } from "@phosphor-icons/react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTheme } from "../../../../../context/ThemeContext";
import CardWrapper from "../../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import Breadcrumbs from "../../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import DataTable from "../../../../../components/dataTable/DataTable";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import LineChartRenderer from "../../../../../components/chartCard/LineChartRenderer";
import VerticalMultiBarRenderer from "../../../../../components/chartCard/VerticalMultiBarRenderer";
import { BLUE_COLOR } from "../../../../../components/chartCard/chartColors";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import { fetchAllChartOfAccounts } from "../../../../../features/finance/chartOfAccounts/private/api/chartOfAccountsService";
import { useAccountMonthlySummary } from "../../../../../features/finance/chartOfAccounts/private/hooks/useAccountMonthlySummary";
import { buildAccountHierarchy, findAccountNode } from "../../../../../functions/buildAccountHierarchy";
import { DRAWER_LABELS } from "../drawerLabels";
import { chartOfAccountsTableConfig } from "../tableConfig";

// Same trailing-12-months default and fiscal-year grouping as
// AccountLedger.jsx's own two charts -- kept as a local, near-identical copy
// rather than a shared import, since AccountLedger.jsx is deliberately left
// untouched by this feature (see this file's own header comment) and these
// are three short, self-contained functions, not a growing shared concern.
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

function fiscalYearLabel(monthDateStr) {
  const d = new Date(monthDateStr);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

/**
 * Detail page for a non-postable (title/summary) GL account -- the
 * AccountDetail.jsx gate renders this instead of AccountLedger.jsx when the
 * clicked account has no lines of its own, only child accounts. Mirrors
 * AccountLedger.jsx's shape (filters, Monthly Balance + Per Annum charts)
 * but swaps the line-level ledger table for a direct-children table --
 * added 2026-09, deliberately DIRECT CHILDREN ONLY, not a flattened
 * every-descendant view, matching both SAP Business One's own native Chart
 * of Accounts drill-down (drawer -> title -> subordinate accounts,
 * navigated one level at a time) and general accounting UX best practice
 * (keep hierarchy drill-down progressive, not flattened).
 *
 * No usePaginatedQuery here -- the children list isn't a server-paginated
 * fetch (it's a slice of the same full-tree fetch Chart of Accounts' own
 * hierarchy view already uses, cached under the same query key), so only
 * the small startDate/endDate URL-filter subset SearchFilterBar/
 * FiscalYearFilterBar actually need is reimplemented directly here, rather
 * than pulling in a hook built for paginated list data this page doesn't
 * have.
 */
export default function CategoryDetail() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const { accountCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
  };
  const activeFilters = Object.entries(filters).filter(([, value]) => value !== "");
  const hasActiveFilters = activeFilters.length > 0;

  function setFilters(newFilters) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      return params;
    });
  }

  function resetParams() {
    setSearchParams({});
  }

  // Same query key Chart of Accounts' own hierarchy view uses -- if the user
  // arrived here by clicking a category in that tree, this is already
  // cached and renders instantly.
  const { data: allAccounts, isLoading: isTreeLoading } = useQuery({
    queryKey: ["finance_chart_of_accounts", "tree"],
    queryFn: fetchAllChartOfAccounts,
    staleTime: 1000 * 60,
  });

  const accountTree = useMemo(
    () => (allAccounts ? buildAccountHierarchy(allAccounts) : []),
    [allAccounts],
  );

  const categoryNode = useMemo(
    () => findAccountNode(accountTree, accountCode),
    [accountTree, accountCode],
  );

  const children = categoryNode?.children || [];
  const columns = chartOfAccountsTableConfig();

  const { data: monthlySummary, isLoading: chartLoading } =
    useAccountMonthlySummary(accountCode);

  const defaultChartRange = useMemo(() => getDefaultChartRange(), []);
  const periodStartDate = filters.startDate || defaultChartRange.startDate;
  const periodEndDate = filters.endDate || defaultChartRange.endDate;

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

  function handleRowClick(child) {
    navigate(`/app/finance/chart-of-accounts/${child.account_code}`);
  }

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs
            icon={TreeStructureIcon}
            current={`${
              categoryNode
                ? DRAWER_LABELS[categoryNode.drawer] || categoryNode.drawer
                : null
            } - ${categoryNode?.account_name || accountCode}`}
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

            <FiscalYearFilterBar filters={filters} onFilterChange={setFilters} />

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
                subtitle="Net debit/credit activity per month (RM) — summed across every account in this category, filtered to the date range/fiscal year above"
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
                subtitle="Net debit/credit activity per fiscal year (RM, April–March) — summed across every account in this category, every year on record"
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

            <div className="cardWrapperScroll">
              {isTreeLoading ? (
                <CardLayout style="cardLayoutFlexFull">
                  <LoadingIcon />
                </CardLayout>
              ) : children.length === 0 ? (
                <NoResult />
              ) : (
                <DataTable
                  data={children}
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
