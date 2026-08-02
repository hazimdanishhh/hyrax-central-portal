import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
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

// Text-only good/bad/neutral coloring for line items below -- reuses
// getStatusVariant's existing good/warning/critical decision (the same
// helper Finance Reports' own KPI tiles use) rather than inventing new
// thresholds, but maps its result straight to a color instead of its
// `variant` class string: that string is a compound class
// (.generalCard.greenCard in src/styles/index.scss) meant for a full KPI
// card, not a bare inline <span>, so applying it here wouldn't style
// anything. undefined (no color) falls through to the existing textBold
// color for neutral/no-verdict values.
const LEVEL_COLOR = { good: GREEN_COLOR, warning: YELLOW_COLOR, critical: RED_COLOR };
const colorFor = (value, options) =>
  options ? LEVEL_COLOR[getStatusVariant(value, options).level] : undefined;

/**
 * Cash Flow Statement (Finance Expansion Phase 3, added 2026-08) --
 * read-only, GL-derived (indirect method), same data source as Financial
 * Reports' "Cash Flow" chart section but with the full line-item breakdown
 * and both reconciliation checks visible. Not a browsable transactional
 * list like Invoices/Bills -- there's no per-row SAP document behind this,
 * it's a computed statement -- so this page reads more like a reference
 * report than a DataTable list, closer in spirit to Chart of Accounts than
 * to Journal Entries. Requires an explicit date range (same as the RPC's
 * own cashFlowStatementData/cashFlowWaterfallData contract): the empty
 * state below asks for one rather than guessing a default period.
 */
export default function CashFlow() {
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

  const statement = dashboard?.cashFlowStatementData ?? null;
  const waterfall = dashboard?.cashFlowWaterfallData ?? null;

  const waterfallChartData = waterfall
    ? Object.entries(waterfall).map(([name, value]) => ({ name, value }))
    : [];

  const hasPeriod = Boolean(filters?.startDate && filters?.endDate);

  // Materiality baseline for the "target-band" (near-zero-is-good)
  // reconciliation checks below -- scales the tolerance to the size of
  // this period's own cash flow rather than a fixed RM figure, since
  // Hyrax's numbers span from the thousands to tens of millions. Floored
  // so a quiet period (netChangeInCash near zero) doesn't flag a small
  // absolute residual as "critical" just because the ratio looks large.
  const materialityBase = statement
    ? Math.max(Math.abs(statement.netChangeInCash), 50_000)
    : 0;
  const reconciliationBand = {
    direction: "target-band",
    thresholds: {
      target: 0,
      warningTolerance: materialityBase * 0.15,
      criticalTolerance: materialityBase * 0.4,
    },
  };

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
          <Breadcrumbs icon={ArrowsClockwiseIcon} current="Cash Flow" />

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

            {isLoading || isFetching ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : error ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="Error loading data." />
              </CardLayout>
            ) : !hasPeriod || !statement || !waterfall ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="Select a date range above — a cash flow statement needs a defined period to compute." />
              </CardLayout>
            ) : (
              <CardLayout style="cardLayout2">
                <ChartCard
                  title="Cash Flow Statement"
                  subtitle={`${statement.periodStart} to ${statement.periodEnd} — General Ledger postings, indirect method`}
                  style="cardGapSmall"
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <p className="textXXS textLight textBold">
                      OPERATING ACTIVITIES
                    </p>
                    {lineItem("Net Profit", waterfall["Net Profit"], {
                      direction: "sign-good",
                    })}
                    {lineItem(
                      "Depreciation & Amortization",
                      waterfall["Depreciation & Amortization"],
                    )}
                    {lineItem(
                      "Change in Working Capital",
                      waterfall["Change in Working Capital"],
                      { direction: "sign-good" },
                    )}
                    {lineItem(
                      "Net Cash from Operating Activities",
                      statement.operatingCashFlow,
                      { direction: "sign-good" },
                    )}

                    <p className="textXXS textLight textBold">
                      INVESTING ACTIVITIES
                    </p>
                    {/* sign-good here is a deliberate simplification for an
                        at-a-glance read -- negative Investing CF isn't
                        inherently unhealthy (it's often just capex for
                        growth), it just means cash went out. */}
                    {lineItem(
                      "Net Cash from Investing Activities",
                      statement.investingCashFlow,
                      { direction: "sign-good" },
                    )}

                    <p className="textXXS textLight textBold">
                      FINANCING ACTIVITIES
                    </p>
                    {lineItem(
                      "Net Cash from Financing Activities",
                      statement.financingCashFlow,
                      { direction: "sign-good" },
                    )}

                    <hr />
                    {lineItem(
                      "Net Change in Cash",
                      statement.netChangeInCash,
                      { direction: "sign-good" },
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Cash Flow Waterfall"
                  subtitle="Operating → Investing → Financing → Net Change in Cash (RM)"
                  style="cardGapSmall"
                >
                  <HorizontalBarChartRenderer
                    data={waterfallChartData}
                    colorMap={BLUE_COLOR}
                  />
                </ChartCard>

                <ChartCard
                  title="Reconciliation Check"
                  subtitle="Computed net change in cash vs. two independent sources — a small residual is expected (SAP's period-end FX revaluation on foreign-currency cash/loan accounts), not necessarily an error. Both figures diverging sharply from each other, or dwarfing plausible FX movement, is still a signal to revisit account classification."
                  style="cardGapSmall"
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {lineItem(
                      "G/L cash-account balance change (2600xxx)",
                      statement.glCashBalanceChange,
                    )}
                    {lineItem(
                      "Bank account movements (OBNK)",
                      statement.bankMovementCashChange,
                    )}
                    <hr />
                    {lineItem(
                      "Effect of exchange rate changes (vs. G/L cash balance)",
                      statement.reconciliationDeltaVsGl,
                      reconciliationBand,
                    )}
                    {lineItem(
                      "Effect of exchange rate changes (vs. bank account movements)",
                      statement.reconciliationDeltaVsBank,
                      reconciliationBand,
                    )}
                  </div>
                </ChartCard>
              </CardLayout>
            )}
          </CardWrapper>
        </div>
      </div>
    </section>
  );
}
