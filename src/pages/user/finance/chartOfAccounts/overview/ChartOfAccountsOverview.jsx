import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import SearchFilterBar from "../../../../../components/searchFilterBar/SearchFilterBar";
import FiscalYearFilterBar from "../../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";
import ActiveFiltersBar from "../../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import CardLayout from "../../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../../components/chartCard/ChartCard";
import VerticalMultiBarRenderer from "../../../../../components/chartCard/VerticalMultiBarRenderer";
import LoadingIcon from "../../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../../components/crud/noResult/NoResult";
import buildFilterUrl from "../../../../../functions/convertFilter";
import { fetchAllChartOfAccounts } from "../../../../../features/finance/chartOfAccounts/private/api/chartOfAccountsService";
import { fetchAccountMonthlySummary } from "../../../../../features/finance/chartOfAccounts/private/api/accountLedgerService";
import { buildAccountHierarchy } from "../../../../../functions/buildAccountHierarchy";
import { groupByFiscalYear } from "../../../../../functions/glFiscalYearGrouping";
import { DRAWER_LABELS, DRAWER_CHART_COLORS } from "../drawerLabels";

// Restricts an all-time per-fiscal-year array to the selected date-range/
// fiscal-year filter, unlike Account Ledger's/Category Detail's own Per
// Annum chart (always full history regardless of filter) -- this overview's
// whole point is comparing drawers over a chosen window, so it has to
// actually respect the filter. "All years on record" when unset, same
// null-means-unbounded convention as every other filter in this app. A
// fiscal year is INCLUDED whenever its own April-March span overlaps the
// selected range at all, not just when fully contained by it.
function filterFiscalYears(yearData, startDate, endDate) {
  if (!startDate && !endDate) return yearData;

  return yearData.filter(({ name }) => {
    const [startYear] = name.split("-").map(Number);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;

    return (!startDate || fyEnd >= startDate) && (!endDate || fyStart <= endDate);
  });
}

/**
 * "Overview" tab (added 2026-09) -- one independent Per Annum chart per
 * level-1/drawer root (Assets, Liabilities, Equity, Turnover, Cost of Sales,
 * Expenses, Other Expenditure), so a Finance user can see which top-level
 * category moved the most in a given window without opening each one's own
 * Category Detail page individually. Small multiples, not one combined
 * chart -- Financial Reports' own "P&L Trend (YoY)" already combines
 * Revenue/COGS/OpEx/Net Profit for the P&L side at the right (derived,
 * comparable-magnitude) granularity; this is the complementary raw-drawer
 * view Financial Reports deliberately doesn't cover, especially for the
 * balance-sheet side (Assets/Liabilities/Equity), which has no combined
 * trend anywhere else since those are stock balances, not period flows --
 * combining them with flow drawers, or with each other at wildly different
 * scales, would flatten the smaller ones. Each chart's bars drill into that
 * drawer's own Category Detail page (same click-through contract Financial
 * Reports' Opex Breakdown chart already uses).
 */
export default function ChartOfAccountsOverview() {
  const navigate = useNavigate();
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

  // Same query key Chart of Accounts' own hierarchy view / Category Detail
  // already use -- instant if either was already opened this session.
  const { data: allAccounts, isLoading: isTreeLoading } = useQuery({
    queryKey: ["finance_chart_of_accounts", "tree"],
    queryFn: fetchAllChartOfAccounts,
    staleTime: 1000 * 60,
  });

  const roots = useMemo(
    () => (allAccounts ? buildAccountHierarchy(allAccounts) : []),
    [allAccounts],
  );

  // One get_account_monthly_summary_rpc.sql call per drawer root, in
  // parallel -- same query key shape useAccountMonthlySummary.js uses, so
  // this shares its cache with Account Ledger/Category Detail.
  const monthlySummaryQueries = useQueries({
    queries: roots.map((root) => ({
      queryKey: ["account_monthly_summary", root.account_code],
      queryFn: () => fetchAccountMonthlySummary({ accountCode: root.account_code }),
      enabled: !!root.account_code,
      staleTime: 1000 * 60,
    })),
  });

  const chartsLoading = isTreeLoading || monthlySummaryQueries.some((q) => q.isLoading);

  const charts = useMemo(
    () =>
      roots.map((root, index) => {
        const monthlySummary = monthlySummaryQueries[index]?.data;
        const yearData = groupByFiscalYear(monthlySummary);

        return {
          accountCode: root.account_code,
          drawer: root.drawer,
          title: DRAWER_LABELS[root.drawer] || root.drawer,
          color: DRAWER_CHART_COLORS[root.drawer] || DRAWER_CHART_COLORS[1],
          data: filterFiscalYears(yearData, filters.startDate, filters.endDate),
        };
      }),
    [roots, monthlySummaryQueries, filters.startDate, filters.endDate],
  );

  // Only carries startDate/endDate through when actually set -- same
  // conditional-spread convention Financial Reports' own chartPeriodFilter
  // uses before calling buildFilterUrl, so an unfiltered click doesn't leave
  // empty startDate=&endDate= params on the destination URL.
  function handleBarClick(accountCode, entry) {
    if (!entry) return;

    const drillFilter = {
      ...(filters.startDate && { startDate: filters.startDate }),
      ...(filters.endDate && { endDate: filters.endDate }),
    };

    navigate(`/app/finance/chart-of-accounts/${accountCode}${buildFilterUrl(drillFilter)}`);
  }

  return (
    <>
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

      <p className="textXXS textLight" style={{ padding: "8px 4px" }}>
        Net debit/credit activity per fiscal year (RM, April–March) for each
        top-level account, summed across every account beneath it. Shows
        every year on record unless a date range/fiscal year is selected
        above. Click a bar to drill into that account's own Category Detail.
      </p>

      <div className="cardWrapperScroll">
        {chartsLoading ? (
          <CardLayout style="cardLayoutFlexFull">
            <LoadingIcon />
          </CardLayout>
        ) : charts.length === 0 ? (
          <NoResult />
        ) : (
          <CardLayout style="cardLayout2">
            {charts.map((chart) => (
              <ChartCard key={chart.accountCode} title={chart.title}>
                {chart.data.length === 0 ? (
                  <NoResult />
                ) : (
                  <VerticalMultiBarRenderer
                    data={chart.data}
                    bars={[
                      {
                        dataKey: "balanceMyr",
                        name: "Balance (RM)",
                        color: chart.color,
                      },
                    ]}
                    onBarClick={(entry) => handleBarClick(chart.accountCode, entry)}
                  />
                )}
              </ChartCard>
            ))}
          </CardLayout>
        )}
      </div>
    </>
  );
}
