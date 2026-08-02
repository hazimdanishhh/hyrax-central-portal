import { ScalesIcon } from "@phosphor-icons/react";
import { useTheme } from "../../../../context/ThemeContext";
import CardWrapper from "../../../../components/cardWrapper/CardWrapper";
import CardLayout from "../../../../components/cardLayout/CardLayout";
import ChartCard from "../../../../components/chartCard/ChartCard";
import HorizontalBarChartRenderer from "../../../../components/chartCard/HorizontalBarChartRenderer";
import {
  YELLOW_COLOR,
  GREEN_COLOR,
  RED_COLOR,
} from "../../../../components/chartCard/chartColors";
import { getStatusVariant } from "../../../../functions/statusVariant";
import Breadcrumbs from "../../../../components/breadcrumbs/Breadcrumbs";
import LoadingIcon from "../../../../components/loadingIcon/LoadingIcon";
import NoResult from "../../../../components/crud/noResult/NoResult";
import useDashboardQuery from "../../../../hooks/useDashboardQuery";
import { fetchFinanceDashboard } from "../../../../features/finance/reports/private/api/fetchFinanceDashboard";
import { compactCurrency } from "../../../../functions/formatNumber";

// Text-only good/bad/neutral coloring -- see CashFlow.jsx's identical
// helper for why this maps getStatusVariant's level to a plain color
// instead of its `variant` class string (that string is a compound class
// meant for a full KPI card, not a bare inline <span>).
const LEVEL_COLOR = { good: GREEN_COLOR, warning: YELLOW_COLOR, critical: RED_COLOR };
const colorFor = (value, options) =>
  options ? LEVEL_COLOR[getStatusVariant(value, options).level] : undefined;

/**
 * Balance Sheet / Statement of Financial Position (added 2026-08) --
 * read-only, same data source as Financial Reports' balance-sheet KPIs and
 * chart, but with the full Level-3 line-item breakdown (confirmed live
 * against sap_gl_accounts during the Cash Flow Statement work -- see
 * get_finance_dashboard_rpc.sql's balanceSheetStatementData comment).
 * Point-in-time, "as of today" -- unlike Cash Flow Statement, a balance
 * sheet has no period to select, so this page has no date-range filter at
 * all; the RPC field itself isn't gated on p_start_date/p_end_date.
 */
export default function BalanceSheet() {
  const { darkMode } = useTheme();

  const {
    data: dashboard,
    isLoading,
    isFetching,
    error,
  } = useDashboardQuery({
    queryKey: "finance_dashboard",
    queryFn: fetchFinanceDashboard,
  });

  const statement = dashboard?.balanceSheetStatementData ?? null;

  const snapshotChartData = statement
    ? [
        { name: "Current Assets", value: statement.currentAssets.total },
        { name: "Fixed Assets", value: statement.fixedAssets.total },
        { name: "Current Liabilities", value: statement.currentLiabilities.total },
        { name: "Total Equity", value: statement.equity.total },
      ]
    : [];

  // Materiality baseline for the balance-check residual below -- same
  // "target-band" treatment as Cash Flow's FX-effect lines. A residual
  // here is expected, not an error: Phase 2's own sign-convention check
  // already documented that Assets vs. Liabilities+Equity land within a
  // gap reflecting the current fiscal year's un-closed earnings (GL only
  // rolls P&L into Retained Earnings at each fiscal year-end closing
  // entry -- see 06-finance-expansion-execution-plan.md's Phase 3
  // follow-up fixes) -- confirmed live 2026-08 that this residual grows
  // over the course of an unclosed fiscal year, it isn't a bug.
  const materialityBase = statement
    ? Math.max(Math.abs(statement.totalAssets), 50_000)
    : 0;
  const balanceCheckBand = {
    direction: "target-band",
    thresholds: {
      target: 0,
      warningTolerance: materialityBase * 0.05,
      criticalTolerance: materialityBase * 0.15,
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
          <Breadcrumbs icon={ScalesIcon} current="Balance Sheet" />

          <CardWrapper>
            {isLoading || isFetching ? (
              <CardLayout style="cardLayoutFlexFull">
                <LoadingIcon />
              </CardLayout>
            ) : error ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="Error loading data." />
              </CardLayout>
            ) : !statement ? (
              <CardLayout style="cardLayoutFlexFull">
                <NoResult title="No balance sheet data available." />
              </CardLayout>
            ) : (
              <CardLayout style="cardLayout2">
                <ChartCard
                  title="Balance Sheet"
                  subtitle="As of today — General Ledger postings, not affected by any date filter"
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
                      CURRENT ASSETS
                    </p>
                    {lineItem("Cash and Bank Balances", statement.currentAssets.cash)}
                    {lineItem("Fixed Deposits", statement.currentAssets.fixedDeposits)}
                    {lineItem("Trade Receivables", statement.currentAssets.tradeReceivables)}
                    {lineItem("Other Receivables", statement.currentAssets.otherReceivables)}
                    {lineItem("Deposits", statement.currentAssets.deposits)}
                    {lineItem("Prepayment", statement.currentAssets.prepayment)}
                    {lineItem("Inventory", statement.currentAssets.inventory)}
                    {lineItem("GST Input Tax", statement.currentAssets.gstInputTax)}
                    {lineItem("Total Current Assets", statement.currentAssets.total)}

                    <p className="textXXS textLight textBold">FIXED ASSETS</p>
                    {lineItem("Fixed Asset", statement.fixedAssets.fixedAsset)}
                    {lineItem("Work In Progress", statement.fixedAssets.workInProgress)}
                    {lineItem("Total Fixed Assets", statement.fixedAssets.total)}

                    <hr />
                    {lineItem("TOTAL ASSETS", statement.totalAssets)}

                    <p className="textXXS textLight textBold">
                      CURRENT LIABILITIES
                    </p>
                    {lineItem("Trade Payable", statement.currentLiabilities.tradePayable)}
                    {lineItem(
                      "Other Payable & Accruals",
                      statement.currentLiabilities.otherPayableAndAccruals,
                    )}
                    {lineItem(
                      "Short Term Borrowings",
                      statement.currentLiabilities.shortTermBorrowings,
                    )}
                    {lineItem("Output Tax", statement.currentLiabilities.outputTax)}
                    {lineItem(
                      "Total Current Liabilities",
                      statement.currentLiabilities.total,
                    )}

                    <hr />
                    {lineItem("TOTAL LIABILITIES", statement.totalLiabilities)}

                    <p className="textXXS textLight textBold">EQUITY</p>
                    {lineItem("Share Capital", statement.equity.shareCapital)}
                    {lineItem("Revaluation Reserve", statement.equity.revaluationReserve)}
                    {lineItem("Retained Earnings", statement.equity.retainedEarnings)}
                    {lineItem("TOTAL EQUITY", statement.equity.total)}

                    <hr />
                    {lineItem(
                      "TOTAL LIABILITIES + EQUITY",
                      statement.totalLiabilitiesAndEquity,
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Balance Sheet Snapshot"
                  subtitle="As of today (RM)"
                  style="cardGapSmall"
                >
                  <HorizontalBarChartRenderer
                    data={snapshotChartData}
                    colorMap={GREEN_COLOR}
                  />
                </ChartCard>

                <ChartCard
                  title="Ratios & Balance Check"
                  subtitle="Current/Quick Ratio and Working Capital, plus Assets vs. Liabilities+Equity — a small residual is expected (this fiscal year's earnings not yet formally closed into Retained Earnings), not necessarily an error"
                  style="cardGapSmall"
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                      className="textXS"
                    >
                      <span className="textLight">Current Ratio</span>
                      <span
                        className="textBold"
                        style={{
                          color: colorFor(statement.currentRatio, {
                            direction: "high-good",
                            thresholds: { warningAt: 1, goodAt: 2 },
                          }),
                        }}
                      >
                        {statement.currentRatio != null
                          ? `${statement.currentRatio.toFixed(2)}x`
                          : "—"}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                      className="textXS"
                    >
                      <span className="textLight">Quick Ratio</span>
                      <span
                        className="textBold"
                        style={{
                          color: colorFor(statement.quickRatio, {
                            direction: "high-good",
                            thresholds: { warningAt: 0.7, goodAt: 1 },
                          }),
                        }}
                      >
                        {statement.quickRatio != null
                          ? `${statement.quickRatio.toFixed(2)}x`
                          : "—"}
                      </span>
                    </div>
                    {lineItem("Working Capital", statement.workingCapital, {
                      direction: "sign-good",
                    })}
                    <hr />
                    {lineItem(
                      "Balance Check (Assets − Liabilities − Equity)",
                      statement.balanceCheckDelta,
                      balanceCheckBand,
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
