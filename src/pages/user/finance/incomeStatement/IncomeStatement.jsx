import { ChartLineUpIcon } from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../components/chartCard/HorizontalBarChartRenderer";
import {
  BLUE_COLOR,
  GREEN_COLOR,
  YELLOW_COLOR,
  RED_COLOR,
} from "../../../../components/chartCard/chartColors";
import { getStatusVariant } from "../../../../functions/statusVariant";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import SearchFilterBar from "../../../../components/searchFilterBar/SearchFilterBar";
import ActiveFiltersBar from "../../../../components/crud/activeFiltersBar/ActiveFiltersBar";
import NoResult from "../../../../components/crud/noResult/NoResult";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import useDashboardQuery from "../../../../hooks/useDashboardQuery";
import { fetchFinanceDashboard } from "../../../../features/finance/reports/private/api/fetchFinanceDashboard";
import { compactCurrency } from "../../../../functions/formatNumber";
import FiscalYearFilterBar from "../../../../components/fiscalYearFilterBar/FiscalYearFilterBar";

// Text-only good/bad/neutral coloring -- see CashFlow.jsx's identical
// helper for why this maps getStatusVariant's level to a plain color
// instead of its `variant` class string (that string is a compound class
// meant for a full KPI card, not a bare inline <span>).
const LEVEL_COLOR = { good: GREEN_COLOR, warning: YELLOW_COLOR, critical: RED_COLOR };
const colorFor = (value, options) =>
  options ? LEVEL_COLOR[getStatusVariant(value, options).level] : undefined;

/**
 * Income Statement (Finance Expansion Phase 6, added 2026-08) -- read-only,
 * GL-derived, same underlying figures as Financial Reports' "P&L Breakdown"/
 * "P&L Trend" charts but in proper statement order with full coloring.
 * Requires an explicit date range, same contract as Cash Flow's
 * cashFlowStatementData -- an all-time P&L spanning every fiscal year isn't
 * a meaningful "statement," so this page asks for a period rather than
 * defaulting to the all-time total plBreakdownData/the kpi tiles show
 * elsewhere on Finance Reports.
 *
 * Coloring: Revenue/Gross Profit/Operating Profit/Net Profit/EBITDA all have
 * an unambiguous "more = good" direction, so each gets sign-good coloring --
 * Gross Profit/Net Profit/EBITDA reuse the exact margin-floor thresholds
 * (15%/5%/10%) already established for their KPI tiles on Finance Reports
 * (see financialReports/config/overviewConfig.js's grossProfitStatus/
 * netProfitStatus/ebitdaStatus), so this page reads the same as those tiles
 * rather than inventing new floors. COGS/Operating Expenses/Other
 * Expenditure/Tax are cost components, not outcomes -- left uncolored, same
 * treatment Cash Flow gives its own "Depreciation & Amortization" line.
 */
export default function IncomeStatement() {
  const { darkMode } = useTheme();

  const {
    data: dashboard,
    filters,
    activeFilters,
    hasActiveFilters,
    setFilters,
    resetParams,
    isLoading,
    isFetching,
    error,
  } = useDashboardQuery({
    queryKey: "finance_dashboard",
    queryFn: fetchFinanceDashboard,
  });

  const statement = dashboard?.incomeStatementData ?? null;

  const hasPeriod = Boolean(filters?.startDate && filters?.endDate);

  const waterfallChartData = statement
    ? [
        { name: "Revenue", value: statement.revenue },
        { name: "COGS", value: -statement.cogs },
        { name: "Gross Profit", value: statement.grossProfit },
        { name: "Operating Expenses", value: -statement.operatingExpenses },
        { name: "Operating Profit", value: statement.operatingProfit },
        { name: "Other Expenditure", value: -statement.otherExpenditure },
        { name: "Tax", value: -statement.tax },
        { name: "Net Profit", value: statement.netProfit },
      ]
    : [];

  const lineItem = (label, value, options) => (
    <div
      key={label}
      style={{ display: "flex", justifyContent: "space-between" }}
      className="textXS"
    >
      <span className="textLight">{label}</span>
      <span className="textBold" style={{ color: colorFor(value, options) }}>
        {compactCurrency(value)}
      </span>
    </div>
  );

  return (
    <section className={darkMode ? "sectionDark" : "sectionLight"}>
      <div className="sectionWrapper">
        <div className="sectionContent">
          <Breadcrumbs icon={ChartLineUpIcon} current="Income Statement" />

          <CardWrapper>
            <SearchFilterBar
              filters={filters}
              onFilterChange={setFilters}
              filterConfig={[]}
              enableDateRange
              disableSearch
              isLoading={isLoading}
              isError={Boolean(error)}
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

            {isLoading || isFetching ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : error ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="Error loading data." />
              </CardLayout>
            ) : !hasPeriod || !statement ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="Select a date range above — an income statement needs a defined period to compute." />
              </CardLayout>
            ) : (
              <CardLayout style="cardLayout2">
                <ChartCard
                  title="Income Statement"
                  subtitle={`${statement.periodStart} to ${statement.periodEnd} — General Ledger postings`}
                  style="cardGapSmall"
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {lineItem("Revenue", statement.revenue, {
                      direction: "sign-good",
                    })}
                    {lineItem("COGS", -statement.cogs)}
                    {lineItem("Gross Profit", statement.grossProfit, {
                      direction: "sign-good",
                      thresholds: {
                        warningRatio: statement.grossProfitMarginPct,
                        warningFloor: 15,
                      },
                    })}
                    <p className="textXXXS textLight">
                      {statement.grossProfitMarginPct}% margin
                    </p>

                    {lineItem("Operating Expenses", -statement.operatingExpenses)}
                    {lineItem("Operating Profit", statement.operatingProfit, {
                      direction: "sign-good",
                    })}

                    {lineItem("Other Expenditure", -statement.otherExpenditure)}
                    {lineItem("Tax", -statement.tax)}

                    <hr />
                    {lineItem("Net Profit", statement.netProfit, {
                      direction: "sign-good",
                      thresholds: {
                        warningRatio: statement.netProfitMarginPct,
                        warningFloor: 5,
                      },
                    })}
                    <p className="textXXXS textLight">
                      {statement.netProfitMarginPct}% margin
                    </p>

                    {lineItem("EBITDA", statement.ebitda, {
                      direction: "sign-good",
                      thresholds: {
                        warningRatio: statement.ebitdaMarginPct,
                        warningFloor: 10,
                      },
                    })}
                    <p className="textXXXS textLight">
                      {statement.ebitdaMarginPct}% margin
                    </p>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Income Statement Waterfall"
                  subtitle="Revenue → Net Profit (RM), this period — General Ledger postings"
                  style="cardGapSmall"
                >
                  <HorizontalBarChartRenderer
                    data={waterfallChartData}
                    colorMap={BLUE_COLOR}
                  />
                </ChartCard>
              </CardLayout>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
