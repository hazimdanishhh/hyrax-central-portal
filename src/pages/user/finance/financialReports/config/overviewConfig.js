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
} from "@phosphor-icons/react";

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

  return [
    // ==========================================
    // PILLAR 1: Revenue Invoiced (What did we bill?)
    // ==========================================
    {
      icon: ReceiptIcon,
      label: "Revenue Invoiced",
      sublabel: "Total Invoiced This Period",
      value: formatRM(kpis.periodInvoicedRevenue),
      variant: "blueCardFill",
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
      title: "Total invoiced revenue in the selected period",
    },

    // ==========================================
    // PILLAR 2: Cash Collected (What did we actually receive?)
    // ==========================================
    {
      icon: WalletIcon,
      label: "Cash Collected",
      sublabel: "Total Collected This Period",
      value: formatRM(kpis.totalCollected),
      variant: "greenCard",
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
      title: "Cash actually applied against invoices via incoming payments",
    },

    // ==========================================
    // PILLAR 3: Outstanding AR (What's still owed to us?)
    // ==========================================
    {
      icon: BankIcon,
      label: "Outstanding AR",
      sublabel: "Open Invoice Balance (Not based on filters)",
      value: formatRM(kpis.outstandingAR),
      variant: "blueCard",
      filter: null,
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
      title: "Current open AR balance across all customers, as of today",
    },

    // ==========================================
    // PILLAR 4: Overdue Risk (What's at risk of not being collected?)
    // ==========================================
    {
      icon: WarningCircleIcon,
      label: "Overdue Risk",
      sublabel: "Value Past Due Date (Not based on filters)",
      value: formatRM(kpis.overdueValue),
      variant: "redCard",
      filter: null,
      metrics: [
        {
          label: "Overdue Invoices",
          value: kpis.overdueInvoiceCount || 0,
          icon: HourglassHighIcon,
        },
      ],
      title: "Open invoices past their due date, as of today",
    },
  ];
}
