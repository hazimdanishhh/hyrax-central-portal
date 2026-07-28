import {
  ReceiptIcon,
  WalletIcon,
  BankIcon,
  WarningCircleIcon,
  TrendUpIcon,
  TrendDownIcon,
  PercentIcon,
  ClockIcon,
  HourglassHighIcon,
  CoinsIcon,
  ChartPieSliceIcon,
  InvoiceIcon,
  HandCoinsIcon,
  ScalesIcon,
  ChartLineUpIcon,
  GaugeIcon,
  StackIcon,
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../../functions/formatNumber";

export function getFinanceOverviewConfig(kpis) {
  const formatRM = (value) => `RM ${Math.round(value || 0).toLocaleString()}`;
  // Ratios (Current Ratio, Quick Ratio) are unitless multiples, not currency
  // -- "1.85x" reads as a ratio the way "RM 1,850,000" reads as an amount.
  // null (division-by-zero guard in the RPC) renders as "—", not "0.00x".
  const formatRatio = (value) =>
    value === null || value === undefined ? "—" : `${Number(value).toFixed(2)}x`;

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

  const grossProfitDelta = calcDelta(
    kpis.periodGrossProfit,
    kpis.prevPeriodGrossProfit,
  );
  const grossProfitDeltaText =
    grossProfitDelta !== null
      ? grossProfitDelta > 0
        ? `↑ ${grossProfitDelta}% vs last period`
        : `↓ ${Math.abs(grossProfitDelta)}% vs last period`
      : "No prior data";

  // YoY (added 2026-07): same period one year back, distinct from the
  // Prev. Period deltas above (immediately preceding period, not same
  // period last year) -- surfaces the seasonality trend those can't.
  const invoicedYoyDelta = calcDelta(
    kpis.periodInvoicedRevenue,
    kpis.yoyPeriodInvoicedRevenue,
  );
  const invoicedYoyDeltaText =
    invoicedYoyDelta !== null
      ? invoicedYoyDelta > 0
        ? `↑ ${invoicedYoyDelta}% vs last year`
        : `↓ ${Math.abs(invoicedYoyDelta)}% vs last year`
      : "No prior data";

  const grossProfitYoyDelta = calcDelta(
    kpis.periodGrossProfit,
    kpis.yoyPeriodGrossProfit,
  );
  const grossProfitYoyDeltaText =
    grossProfitYoyDelta !== null
      ? grossProfitYoyDelta > 0
        ? `↑ ${grossProfitYoyDelta}% vs last year`
        : `↓ ${Math.abs(grossProfitYoyDelta)}% vs last year`
      : "No prior data";

  // Accounts Payable chain (Finance Expansion Phase 1, added 2026-07)
  const billedDelta = calcDelta(kpis.periodBilled, kpis.prevPeriodBilled);
  const billedDeltaText =
    billedDelta !== null
      ? billedDelta > 0
        ? `↑ ${billedDelta}% vs last period`
        : `↓ ${Math.abs(billedDelta)}% vs last period`
      : "No prior data";

  const paidDelta = calcDelta(kpis.totalPaid, kpis.prevTotalPaid);
  const paidDeltaText =
    paidDelta !== null
      ? paidDelta > 0
        ? `↑ ${paidDelta}% vs last period`
        : `↓ ${Math.abs(paidDelta)}% vs last period`
      : "No prior data";

  // General Ledger (Finance Expansion Phase 2, added 2026-07)
  const netProfitDelta = calcDelta(kpis.netProfit, kpis.prevNetProfit);
  const netProfitDeltaText =
    netProfitDelta !== null
      ? netProfitDelta > 0
        ? `↑ ${netProfitDelta}% vs last period`
        : `↓ ${Math.abs(netProfitDelta)}% vs last period`
      : "No prior data";

  const netProfitYoyDelta = calcDelta(kpis.netProfit, kpis.yoyNetProfit);
  const netProfitYoyDeltaText =
    netProfitYoyDelta !== null
      ? netProfitYoyDelta > 0
        ? `↑ ${netProfitYoyDelta}% vs last year`
        : `↓ ${Math.abs(netProfitYoyDelta)}% vs last year`
      : "No prior data";

  return [
    // ==========================================
    // PILLAR 1: Revenue Invoiced (What did we bill?)
    // ==========================================
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
        {
          label: "vs Last Year",
          value: invoicedYoyDeltaText,
          icon:
            invoicedYoyDelta === null
              ? null
              : invoicedYoyDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
      ],
      title: `Total invoiced revenue in the selected period — ${formatRM(kpis.periodInvoicedRevenue)}`,
    },

    // ==========================================
    // PILLAR 2: Cash Collected (What did we actually receive?)
    // ==========================================
    {
      icon: WalletIcon,
      label: "Cash Collected",
      sublabel: "Total Collected This Period",
      value: compactCurrency(kpis.totalCollected),
      variant: "greenCard",
      // Payments list now exists (src/pages/user/finance/payments) -- link
      // straight through, unfiltered. Not passing the current date-range
      // filter through, mirroring Revenue Invoiced's own "../invoices" link
      // just above, which doesn't pass its period filter through either.
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
      title: `Cash actually applied against invoices via incoming payments — ${formatRM(kpis.totalCollected)}`,
    },

    // ==========================================
    // PILLAR 3: Gross Profit (What did we make on what we billed?)
    // ==========================================
    {
      icon: ChartPieSliceIcon,
      label: "Gross Profit",
      sublabel: "Total Gross Profit This Period",
      value: compactCurrency(kpis.periodGrossProfit),
      variant: "blueCardFill",
      to: null,
      filter: null,
      metrics: [
        {
          label: "GP Margin",
          value: `${kpis.grossProfitMarginPct || 0}%`,
          icon: PercentIcon,
        },
        {
          label: "Prev. Period",
          value: grossProfitDeltaText,
          icon:
            grossProfitDelta === null
              ? null
              : grossProfitDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
        {
          label: "vs Last Year",
          value: grossProfitYoyDeltaText,
          icon:
            grossProfitYoyDelta === null
              ? null
              : grossProfitYoyDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
      ],
      title: `Total gross profit on invoiced revenue in the selected period (SAP's own GrosProfit field, with the item-cost-outlier guard applied) — ${formatRM(kpis.periodGrossProfit)}`,
    },

    // ==========================================
    // PILLAR 4: Outstanding AR (What's still owed to us?)
    // ==========================================
    {
      icon: BankIcon,
      label: "Outstanding AR",
      sublabel: "Open Invoice Balance (Not based on period)",
      value: compactCurrency(kpis.outstandingAR),
      variant: "yellowCard",
      to: "../invoices",
      filter: { statusCode: "O" },
      metrics: [
        {
          label: "DSO",
          value: `${kpis.dso || 0} Days`,
          icon: ClockIcon,
        },
        {
          label: "Unallocated Payments",
          value: formatRM(kpis.unallocatedPayments),
          icon: CoinsIcon,
        },
      ],
      title: `Current open AR balance across all customers, as of today — ${formatRM(kpis.outstandingAR)}`,
    },

    // ==========================================
    // PILLAR 5: Overdue Risk (What's at risk of not being collected?)
    // ==========================================
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

    // ==========================================
    // Accounts Payable chain (Finance Expansion Phase 1, added 2026-07)
    // ==========================================

    // PILLAR 6: Bills Received (What have vendors billed us?)
    {
      icon: InvoiceIcon,
      label: "Bills Received",
      sublabel: "Total Billed This Period",
      value: compactCurrency(kpis.periodBilled),
      variant: "blueCardFill",
      to: "../bills",
      filter: null,
      metrics: [
        {
          label: "Bills Received",
          value: kpis.periodBillCount || 0,
        },
        {
          label: "Prev. Period",
          value: billedDeltaText,
          icon:
            billedDelta === null
              ? null
              : billedDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
      ],
      title: `Total vendor bills received in the selected period — ${formatRM(kpis.periodBilled)}`,
    },

    // PILLAR 7: Cash Paid (What did we actually pay out?)
    {
      icon: HandCoinsIcon,
      label: "Cash Paid",
      sublabel: "Total Paid This Period",
      value: compactCurrency(kpis.totalPaid),
      variant: "greenCard",
      to: "../vendor-payments",
      filter: null,
      metrics: [
        {
          label: "DPO",
          value: `${kpis.dpo || 0} Days`,
          icon: ClockIcon,
        },
        {
          label: "Prev. Period",
          value: paidDeltaText,
          icon:
            paidDelta === null ? null : paidDelta >= 0 ? TrendUpIcon : TrendDownIcon,
        },
      ],
      title: `Cash actually paid out to vendors via outgoing payments — ${formatRM(kpis.totalPaid)}`,
    },

    // PILLAR 8: Outstanding AP (What do we still owe?)
    {
      icon: BankIcon,
      label: "Outstanding AP",
      sublabel: "Open Bill Balance (Not based on period)",
      value: compactCurrency(kpis.outstandingAP),
      variant: "yellowCard",
      to: "../bills",
      filter: { statusCode: "O" },
      metrics: [
        {
          label: "Unallocated Payments",
          value: formatRM(kpis.unallocatedOutgoingPayments),
          icon: CoinsIcon,
        },
      ],
      title: `Current open AP balance across all vendors, as of today — ${formatRM(kpis.outstandingAP)}`,
    },

    // PILLAR 9: Overdue Payables (What's at risk of a late-payment penalty/relationship hit?)
    {
      icon: WarningCircleIcon,
      label: "Overdue Payables",
      sublabel: "Value Past Due Date (Not based on period)",
      value: compactCurrency(kpis.overdueBillValue),
      variant: "redCard",
      to: "../bills",
      filter: { statusCode: "O", overdueOnly: "true" },
      metrics: [
        {
          label: "Overdue Bills",
          value: kpis.overdueBillCount || 0,
          icon: HourglassHighIcon,
        },
      ],
      title: `Open vendor bills past their due date, as of today — ${formatRM(kpis.overdueBillValue)}`,
    },

    // PILLAR 10: Net AR/AP Position (subledger-level signal, distinct from the GL-based Working Capital below)
    {
      icon: ScalesIcon,
      label: "Net AR/AP Position",
      sublabel: "Outstanding AR minus Outstanding AP",
      value: compactCurrency(kpis.netArApPosition),
      variant: "blueCardFill",
      to: null,
      filter: null,
      metrics: [],
      title: `Outstanding AR (${formatRM(kpis.outstandingAR)}) minus Outstanding AP (${formatRM(kpis.outstandingAP)}) — a subledger-level signal, distinct from the full General-Ledger-based Working Capital figure below (the two won't generally match exactly) — ${formatRM(kpis.netArApPosition)}`,
    },

    // ==========================================
    // General Ledger (Finance Expansion Phase 2, added 2026-07)
    // ==========================================

    // PILLAR 11: Net Profit (What did we actually earn, after everything?)
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
        {
          label: "vs Last Year",
          value: netProfitYoyDeltaText,
          icon:
            netProfitYoyDelta === null
              ? null
              : netProfitYoyDelta >= 0
                ? TrendUpIcon
                : TrendDownIcon,
        },
      ],
      title: `Revenue − COGS − Operating Expenses − Other Expenditure − Tax, from actual General Ledger postings — ${formatRM(kpis.netProfit)}`,
    },

    // PILLAR 12: EBITDA (approximate -- see RPC-REFERENCE.md for the exact add-back methodology)
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

    // PILLAR 13: Current Ratio & Quick Ratio (Can we cover what we owe soon?)
    {
      icon: ScalesIcon,
      label: "Current Ratio",
      sublabel: "Current Assets ÷ Current Liabilities (Not based on period)",
      value: formatRatio(kpis.currentRatio),
      variant: "yellowCard",
      to: null,
      filter: null,
      metrics: [
        {
          label: "Quick Ratio",
          value: formatRatio(kpis.quickRatio),
          icon: ScalesIcon,
        },
      ],
      title: `Current Assets (${formatRM(kpis.currentAssets)}) ÷ Current Liabilities (${formatRM(kpis.currentLiabilities)}), as of today. Quick Ratio excludes Inventory and Prepayments from Current Assets — ${formatRatio(kpis.currentRatio)}`,
    },

    // PILLAR 14: Working Capital (the full General-Ledger-based figure)
    {
      icon: StackIcon,
      label: "Working Capital",
      sublabel: "Current Assets minus Current Liabilities (Not based on period)",
      value: compactCurrency(kpis.workingCapital),
      variant: "blueCardFill",
      to: null,
      filter: null,
      metrics: [
        {
          label: "Total Assets",
          value: formatRM(kpis.totalAssets),
        },
        {
          label: "Total Equity",
          value: formatRM(kpis.totalEquity),
        },
      ],
      title: `Current Assets (${formatRM(kpis.currentAssets)}) minus Current Liabilities (${formatRM(kpis.currentLiabilities)}), as of today, from actual General Ledger balances — ${formatRM(kpis.workingCapital)}`,
    },
  ];
}
