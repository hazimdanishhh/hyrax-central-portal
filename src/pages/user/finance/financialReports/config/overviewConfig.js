import {
  ReceiptIcon,
  WalletIcon,
  WarningCircleIcon,
  TrendUpIcon,
  TrendDownIcon,
  PercentIcon,
  ClockIcon,
  HourglassHighIcon,
  ChartPieSliceIcon,
  ScalesIcon,
  ChartLineUpIcon,
  GaugeIcon,
  StackIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../../functions/formatNumber";

// Finance Reports redesign, Pass 1 (added 2026-07): rebuilt from 14 headline
// tiles down to 8, following the "~7 headline numbers" / "what -> so what ->
// now what" methodology in hyrax-data-platform/docs/sap-data-architecture-
// plans/03-executive-dashboard-framework.md, and telling 02's own Finance
// Story directly ("Are we profitable, liquid, and is cash locked up in
// operations?") in two blocks: Profitability (tiles 1-4), then Liquidity/
// cash (tiles 5-8). Six of the previous 14 tiles are demoted, not deleted --
// each is now a strict subset of an existing chart one section down
// (Outstanding AR/AP subsumed by the AR/AP Aging charts, Overdue Payables by
// Top Overdue Vendors, Bills Received by Top Vendors by Spend, Cash Paid's
// DPO promoted into the new Cash Cycle tile below). Net AR/AP Position was
// removed outright (not demoted) -- its own former tooltip already said
// Working Capital superseded it. See 06-finance-expansion-execution-plan.md
// for the full before/after disposition table.
export function getFinanceOverviewConfig(kpis, filters) {
  const formatRM = (value) => `RM ${Math.round(value || 0).toLocaleString()}`;
  // Ratios (Current Ratio, Quick Ratio) are unitless multiples, not currency
  // -- "1.85x" reads as a ratio the way "RM 1,850,000" reads as an amount.
  // null (division-by-zero guard in the RPC) renders as "—", not "0.00x".
  const formatRatio = (value) =>
    value === null || value === undefined
      ? "—"
      : `${Number(value).toFixed(2)}x`;

  // Calculate percentage change function (mirrors sales leads overview config)
  const calcDelta = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    if (previous === 0 && current === 0) return 0;
    if (previous === 0 && current > 0) return 100;

    return Math.round(((current - previous) / previous) * 100);
  };

  const invoicedDelta = calcDelta(
    kpis.periodInvoicedRevenue,
    kpis.prevPeriodInvoicedRevenue,
  );
  const invoicedDeltaText =
    invoicedDelta !== null
      ? invoicedDelta > 0
        ? `↑ ${invoicedDelta}% vs last period`
        : `↓ ${Math.abs(invoicedDelta)}% vs last period`
      : "No prior data";

  const collectedDelta = calcDelta(
    kpis.totalCollected,
    kpis.prevTotalCollected,
  );
  const collectedDeltaText =
    collectedDelta !== null
      ? collectedDelta > 0
        ? `↑ ${collectedDelta}% vs last period`
        : `↓ ${Math.abs(collectedDelta)}% vs last period`
      : "No prior data";

  // Gross Profit is now GL-based (glGrossProfit), not the invoice-based
  // periodGrossProfit -- see the Pass 1 header comment above. Its delta
  // needs the matching GL-based prevGlGrossProfit field (added alongside
  // this redesign), not the older prevPeriodGrossProfit.
  const glGrossProfitDelta = calcDelta(
    kpis.glGrossProfit,
    kpis.prevGlGrossProfit,
  );
  const glGrossProfitDeltaText =
    glGrossProfitDelta !== null
      ? glGrossProfitDelta > 0
        ? `↑ ${glGrossProfitDelta}% vs last period`
        : `↓ ${Math.abs(glGrossProfitDelta)}% vs last period`
      : "No prior data";

  const netProfitDelta = calcDelta(kpis.netProfit, kpis.prevNetProfit);
  const netProfitDeltaText =
    netProfitDelta !== null
      ? netProfitDelta > 0
        ? `↑ ${netProfitDelta}% vs last period`
        : `↓ ${Math.abs(netProfitDelta)}% vs last period`
      : "No prior data";

  // Conditional DSO caveat (added 2026-07): DSO uses today's outstanding AR
  // balance regardless of the selected period's end date -- accurate for the
  // common case (a period ending at/near today) but imprecise for an old,
  // closed-out historical period, since no historical AR snapshot exists to
  // compute a true period-end balance from. Only worth surfacing when it
  // actually applies, not as permanent tooltip noise.
  const isHistoricalPeriod = (() => {
    if (!filters?.endDate) return false;
    const daysSinceEnd =
      (Date.now() - new Date(filters.endDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceEnd > 30;
  })();
  const dsoCaveat = isHistoricalPeriod
    ? " Note: DSO uses today's AR balance, not the selected period's end-of-period balance — precision is reduced for historical periods."
    : "";

  return [
    // ==========================================
    // PROFITABILITY
    // ==========================================

    // TILE 1: Revenue Invoiced (What did we bill?)
    {
      icon: ReceiptIcon,
      label: "Revenue Invoiced",
      sublabel: "Total Invoiced This Period",
      value: compactCurrency(kpis.periodInvoicedRevenue),
      variant: "blueCardFill",
      to: "../invoices",
      filter: null,
      metrics: [
        {
          label: "Invoices Issued",
          value: kpis.periodInvoiceCount || 0,
        },
        {
          label: "Prev. Period",
          value: invoicedDeltaText,
          icon:
            invoicedDelta === null
              ? null
              : invoicedDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
      ],
      title: `Total invoiced revenue in the selected period — ${formatRM(kpis.periodInvoicedRevenue)}`,
    },

    // TILE 2: Gross Profit (What did we make, from actual GL postings?)
    {
      icon: ChartPieSliceIcon,
      label: "Gross Profit",
      sublabel: "Total Gross Profit This Period",
      value: compactCurrency(kpis.glGrossProfit),
      variant: "blueCardFill",
      to: null,
      filter: null,
      metrics: [
        {
          label: "GP Margin",
          value: `${kpis.glGrossProfitMarginPct || 0}%`,
          icon: PercentIcon,
        },
        {
          label: "Prev. Period",
          value: glGrossProfitDeltaText,
          icon:
            glGrossProfitDelta === null
              ? null
              : glGrossProfitDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
        // Demoted, not deleted (2026-07): the invoice-based figure this tile
        // used to show outright. Kept visible here for audit purposes --
        // it's also the only Gross Profit figure with a per-sales-rep
        // breakdown, still load-bearing for the Salesperson Health chart.
        {
          label: "Invoice GP (SAP)",
          value: formatRM(kpis.periodGrossProfit),
        },
      ],
      title: `Gross profit from actual General Ledger postings (Revenue − COGS), for the selected period. Distinct from the invoice-line figure shown in Salesperson Health (SAP's own per-invoice GrosProfit field) — the two are sourced differently and won't generally reconcile exactly — ${formatRM(kpis.glGrossProfit)}`,
    },

    // TILE 3: Net Profit (What did we actually earn, after everything?)
    {
      icon: ChartLineUpIcon,
      label: "Net Profit",
      sublabel: "Total Net Profit This Period",
      value: compactCurrency(kpis.netProfit),
      variant: "greenCard",
      to: null,
      filter: null,
      metrics: [
        {
          label: "Net Margin",
          value: `${kpis.netProfitMarginPct || 0}%`,
          icon: PercentIcon,
        },
        {
          label: "Prev. Period",
          value: netProfitDeltaText,
          icon:
            netProfitDelta === null
              ? null
              : netProfitDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
      ],
      title: `Revenue − COGS − Operating Expenses − Other Expenditure − Tax, from actual General Ledger postings — ${formatRM(kpis.netProfit)}`,
    },

    // TILE 4: EBITDA (approximate -- see RPC-REFERENCE.md for the exact add-back methodology)
    {
      icon: GaugeIcon,
      label: "EBITDA",
      sublabel: "Approximate — Net Profit + Interest + Tax + D&A",
      value: compactCurrency(kpis.ebitda),
      variant: "blueCardFill",
      to: null,
      filter: null,
      metrics: [
        {
          label: "EBITDA Margin",
          value: `${kpis.ebitdaMarginPct || 0}%`,
          icon: PercentIcon,
        },
      ],
      title: `Net Profit with Interest, Tax, and Depreciation/Amortization added back — the Depreciation/Amortization add-back is name-pattern-based, not structural (see RPC-REFERENCE.md), so treat this as a best-effort approximation, not a fully audited figure — ${formatRM(kpis.ebitda)}`,
    },

    // ==========================================
    // LIQUIDITY / CASH
    // ==========================================

    // TILE 5: Cash Collected (What did we actually receive?)
    {
      icon: WalletIcon,
      label: "Cash Collected",
      sublabel: "Total Collected This Period",
      value: compactCurrency(kpis.totalCollected),
      variant: "greenCard",
      // Payments list -- link straight through, unfiltered. Not passing the
      // current date-range filter through, mirroring Revenue Invoiced's own
      // "../invoices" link above, which doesn't pass its period filter
      // through either.
      to: "../payments",
      filter: null,
      metrics: [
        {
          label: "Collection Rate",
          value: `${kpis.collectionRatePct || 0}%`,
          icon: PercentIcon,
        },
        {
          label: "Prev. Period",
          value: collectedDeltaText,
          icon:
            collectedDelta === null
              ? null
              : collectedDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
      ],
      title: `Cash actually applied against invoices via incoming payments — only cash traceable to a specific invoice through SAP's payment-application records; on-account cash and other document types that also reduce AR aren't included here (see the AR Aging chart for the full outstanding picture) — ${formatRM(kpis.totalCollected)}`,
    },

    // TILE 6: Overdue Risk (What's at risk of not being collected?)
    {
      icon: WarningCircleIcon,
      label: "Overdue Risk",
      sublabel: "Value Past Due Date (Not based on period)",
      value: compactCurrency(kpis.overdueValue),
      variant: "redCard",
      to: "../invoices",
      filter: { statusCode: "O", overdueOnly: "true" },
      metrics: [
        {
          label: "Overdue Invoices",
          value: kpis.overdueInvoiceCount || 0,
          icon: HourglassHighIcon,
        },
      ],
      title: `Open invoices past their due date, as of today — ${formatRM(kpis.overdueValue)}`,
    },

    // TILE 7: Cash Cycle (Is cash locked up in AR/AP?) -- new, synthesized
    // from the dso/dpo fields, previously buried as sub-metrics on two
    // different (now-demoted) tiles.
    {
      icon: ArrowsClockwiseIcon,
      label: "Cash Cycle",
      sublabel: "Avg. Days to Collect vs. Pay (Not based on period)",
      value: `${kpis.dso || 0} Days`,
      variant: "yellowCard",
      to: null,
      filter: null,
      metrics: [
        {
          label: "DPO",
          value: `${kpis.dpo || 0} Days`,
          icon: ClockIcon,
        },
      ],
      title: `Days Sales Outstanding (DSO) and Days Payable Outstanding (DPO) — the two legs of the Cash Conversion Cycle that are built. Full Cash Conversion Cycle (DSO + DIO − DPO) isn't available yet: Days Inventory Outstanding needs per-warehouse inventory valuation (Finance Expansion Phase 3, not started).${dsoCaveat} DSO: ${kpis.dso || 0} days, DPO: ${kpis.dpo || 0} days`,
    },

    // TILE 8: Working Capital (Can we cover what we owe soon?) -- absorbs
    // the previous standalone Current Ratio tile's Current/Quick Ratio
    // sub-metrics.
    {
      icon: StackIcon,
      label: "Working Capital",
      sublabel:
        "Current Assets minus Current Liabilities (Not based on period)",
      value: compactCurrency(kpis.workingCapital),
      variant: "blueCardFill",
      to: null,
      filter: null,
      metrics: [
        {
          label: "Current Ratio",
          value: formatRatio(kpis.currentRatio),
          icon: ScalesIcon,
        },
        {
          label: "Quick Ratio",
          value: formatRatio(kpis.quickRatio),
          icon: ScalesIcon,
        },
      ],
      title: `Current Assets (${formatRM(kpis.currentAssets)}) minus Current Liabilities (${formatRM(kpis.currentLiabilities)}), as of today, from actual General Ledger balances. Total Assets: ${formatRM(kpis.totalAssets)}, Total Equity: ${formatRM(kpis.totalEquity)} (see the Balance Sheet Snapshot chart for the full composition). Outstanding AR minus Outstanding AP, a narrower subledger-level cross-check: ${formatRM(kpis.netArApPosition)} — ${formatRM(kpis.workingCapital)}`,
    },
  ];
}
