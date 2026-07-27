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
} from "@phosphor-icons/react";
import { compactCurrency } from "../../../../../functions/formatNumber";

export function getFinanceOverviewConfig(kpis) {
  const formatRM = (value) => `RM ${Math.round(value || 0).toLocaleString()}`;

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

    // PILLAR 10: Net AR/AP Position (partial Working Capital signal, ahead of GL/Phase 2)
    {
      icon: ScalesIcon,
      label: "Net AR/AP Position",
      sublabel: "Outstanding AR minus Outstanding AP",
      value: compactCurrency(kpis.netArApPosition),
      variant: "blueCardFill",
      to: null,
      filter: null,
      metrics: [],
      title: `Outstanding AR (${formatRM(kpis.outstandingAR)}) minus Outstanding AP (${formatRM(kpis.outstandingAP)}) — a partial Working Capital signal; the full picture needs General Ledger data (Finance Expansion Phase 2, not yet built) — ${formatRM(kpis.netArApPosition)}`,
    },
  ];
}
